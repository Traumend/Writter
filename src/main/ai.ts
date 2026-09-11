import Anthropic from '@anthropic-ai/sdk'
import { checkSafeguards, estimateTokens } from '../core/safeguards'
import type { AiProposal, AiRequest, ProjectConfig } from '../core/types/ipc'
import { getKey } from './keys'

// Motor de IA (M3). Solo main: aquí viven las claves y la red (I3). Nunca escribe a disco (I2).
const SYSTEM = `Eres un asistente de escritura de guiones. Recibes un fragmento objetivo (landing point) y contexto.
Devuelve SOLO el texto que reemplaza al fragmento objetivo, en formato Fountain, sin explicaciones ni fences.
Si no hay que cambiar nada, devuelve el fragmento tal cual. Tras el texto, en una última línea separada, escribe "---RATIONALE---" seguido de una frase breve.`

function buildPrompt(req: AiRequest) {
  return `SCOPE: ${req.scope}\n\nCONTEXTO:\n${req.context}\n\nFRAGMENTO OBJETIVO (líneas ${req.from + 1}-${req.to}):\n${req.target}\n\nINSTRUCCIÓN:\n${req.instruction}`
}

function split(text: string): { replacement: string; rationale: string } {
  const [rep = '', rat = ''] = text.split('---RATIONALE---')
  return { replacement: rep.replace(/\n$/, ''), rationale: rat.trim() }
}

async function callAnthropic(prompt: string, model: string): Promise<{ text: string; tokensIn: number; tokensOut: number; model: string }> {
  const apiKey = getKey('anthropic')
  if (!apiKey) throw new Error('Sin clave BYOK para anthropic')
  const client = new Anthropic({ apiKey })
  const msg = await client.messages
    .stream({ model, max_tokens: 16000, system: SYSTEM, output_config: { effort: 'medium' }, messages: [{ role: 'user', content: prompt }] })
    .finalMessage()
  if (msg.stop_reason === 'refusal') throw new Error(`El modelo rechazó la petición${msg.stop_details?.explanation ? ': ' + msg.stop_details.explanation : ''}`)
  const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
  return { text, tokensIn: msg.usage.input_tokens, tokensOut: msg.usage.output_tokens, model: msg.model }
}

// Ollama local: API HTTP propia, sin SDK oficial (I8: gratis y offline).
async function callOllama(prompt: string, model: string) {
  const r = await fetch('http://127.0.0.1:11434/api/generate', {
    method: 'POST',
    body: JSON.stringify({ model, system: SYSTEM, prompt, stream: false })
  })
  if (!r.ok) throw new Error(`Ollama respondió ${r.status}`)
  const j = (await r.json()) as { response: string; prompt_eval_count?: number; eval_count?: number }
  return { text: j.response, tokensIn: j.prompt_eval_count ?? estimateTokens(prompt), tokensOut: j.eval_count ?? estimateTokens(j.response), model }
}

export async function runAi(req: AiRequest, cfg: ProjectConfig): Promise<AiProposal> {
  if (req.locked && !req.allowLocked) throw new Error('Región locked sin autorización explícita (I4).')
  const prompt = buildPrompt(req)
  const provider = cfg.byok.provider
  const model = cfg.byok.model ?? (provider === 'anthropic' ? 'claude-opus-5' : 'llama3.1')
  const r = provider === 'ollama' ? await callOllama(prompt, model) : provider === 'anthropic' ? await callAnthropic(prompt, model) : null
  if (!r) throw new Error(`Proveedor no soportado: ${provider}`) // ponytail: openai/gemini cuando alguien los pida
  const { replacement, rationale } = split(r.text)
  const guard = checkSafeguards({ locked: req.locked, allowLocked: req.allowLocked, replacement, target: req.target })
  if (!guard.ok) throw new Error(guard.reason)
  return { replacement, rationale, tokensIn: r.tokensIn, tokensOut: r.tokensOut, model: r.model, docHash: req.docHash }
}
