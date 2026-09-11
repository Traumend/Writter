import Anthropic from '@anthropic-ai/sdk'
import { checkSafeguards, estimateTokens } from '../core/safeguards'
import type { AiProposal, AiRequest, AiText, Analysis, ProjectConfig } from '../core/types/ipc'
import { getKey } from './keys'

// Motor de IA (M3/C/D). Solo main: aquí viven las claves y la red (I3). Nunca escribe al vault por su cuenta (I2).
type Raw = { text: string; tokensIn: number; tokensOut: number; model: string }

async function callAnthropic(system: string, prompt: string, model: string): Promise<Raw> {
  const apiKey = getKey('anthropic')
  if (!apiKey) throw new Error('Sin clave BYOK para anthropic')
  const client = new Anthropic({ apiKey })
  const msg = await client.messages
    .stream({ model, max_tokens: 32000, system, output_config: { effort: 'medium' }, messages: [{ role: 'user', content: prompt }] })
    .finalMessage()
  if (msg.stop_reason === 'refusal') throw new Error(`El modelo rechazó la petición${msg.stop_details?.explanation ? ': ' + msg.stop_details.explanation : ''}`)
  const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
  return { text, tokensIn: msg.usage.input_tokens, tokensOut: msg.usage.output_tokens, model: msg.model }
}

// Ollama local: API HTTP propia, sin SDK oficial (I8: gratis y offline).
async function callOllama(system: string, prompt: string, model: string): Promise<Raw> {
  const r = await fetch('http://127.0.0.1:11434/api/generate', { method: 'POST', body: JSON.stringify({ model, system, prompt, stream: false }) })
  if (!r.ok) throw new Error(`Ollama respondió ${r.status}`)
  const j = (await r.json()) as { response: string; prompt_eval_count?: number; eval_count?: number }
  return { text: j.response, tokensIn: j.prompt_eval_count ?? estimateTokens(prompt), tokensOut: j.eval_count ?? estimateTokens(j.response), model }
}

function call(cfg: ProjectConfig, system: string, prompt: string): Promise<Raw> {
  const { provider } = cfg.byok
  const model = cfg.byok.model ?? (provider === 'anthropic' ? 'claude-opus-5' : 'llama3.1')
  if (provider === 'ollama') return callOllama(system, prompt, model)
  if (provider === 'anthropic') return callAnthropic(system, prompt, model)
  throw new Error(`Proveedor no soportado: ${provider}`) // ponytail: openai/gemini cuando alguien los pida
}

export async function runAi(req: AiRequest, cfg: ProjectConfig): Promise<AiProposal> {
  if (req.locked && !req.allowLocked) throw new Error('Región locked sin autorización explícita (I4).')
  const prompt = `SCOPE: ${req.scope}\n\nCONTEXTO:\n${req.context}\n\nFRAGMENTO OBJETIVO (líneas ${req.from + 1}-${req.to}):\n${req.target}\n\nINSTRUCCIÓN:\n${req.instruction}`
  const r = await call(cfg, cfg.prompts.assistant, prompt)
  const [rep = '', rat = ''] = r.text.split('---RATIONALE---')
  const replacement = rep.replace(/\n$/, '')
  const guard = checkSafeguards({ locked: req.locked, allowLocked: req.allowLocked, replacement, target: req.target })
  if (!guard.ok) throw new Error(guard.reason)
  return { replacement, rationale: rat.trim(), tokensIn: r.tokensIn, tokensOut: r.tokensOut, model: r.model, docHash: req.docHash }
}

// Texto libre para un campo (C): el renderer lo muestra como propuesta y el usuario acepta.
export async function aiText(instruction: string, context: string, cfg: ProjectConfig): Promise<AiText> {
  const system = 'Eres un desarrollador de personajes y guiones. Responde solo con el texto pedido, sin preámbulos ni formato Markdown.'
  return call(cfg, system, `CONTEXTO:\n${context}\n\nPETICIÓN:\n${instruction}`)
}

// Análisis del guión (D): JSON por escena. Se guarda como derivado; nunca toca el .md.
export async function analyze(text: string, cfg: ProjectConfig): Promise<Omit<Analysis, 'id' | 'ts'>> {
  const r = await call(cfg, cfg.prompts.analysis, text)
  const m = /\{[\s\S]*\}/.exec(r.text)
  if (!m) throw new Error('El modelo no devolvió JSON')
  const j = JSON.parse(m[0]) as Partial<Analysis>
  const num = (v: unknown) => Math.max(0, Math.min(10, Number(v) || 0))
  return {
    model: r.model,
    structure: String(j.structure ?? ''),
    plot: String(j.plot ?? ''),
    theme: String(j.theme ?? ''),
    tone: String(j.tone ?? ''),
    notes: Array.isArray(j.notes) ? j.notes.map(String) : [],
    scenes: (Array.isArray(j.scenes) ? j.scenes : []).map((s, i) => ({
      index: Number(s.index ?? i),
      summary: String(s.summary ?? ''),
      emotion: String(s.emotion ?? 'Neutral'),
      intensity: num(s.intensity),
      tension: num(s.tension),
      attention: num(s.attention),
      notes: Array.isArray(s.notes) ? s.notes.map(String) : []
    }))
  }
}
