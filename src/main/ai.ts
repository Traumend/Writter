import Anthropic from '@anthropic-ai/sdk'
import { checkSafeguards, estimateTokens } from '../core/safeguards'
import type { AiProposal, AiRequest, AiText, Analysis, ProjectConfig, Provider } from '../core/types/ipc'
import { getKey } from './keys'
import { logUsage } from './vault'

// Motor de IA. Solo main: aquí viven las claves y la red (I3). Nunca escribe al vault por su cuenta (I2).
type Raw = { text: string; tokensIn: number; tokensOut: number; model: string }

// Endpoints compatibles con la API de OpenAI (chat/completions). Gemini y los demás caben aquí con su baseUrl.
const OPENAI_COMPAT: Partial<Record<Provider, string>> = {
  openai: 'https://api.openai.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  deepseek: 'https://api.deepseek.com/v1',
  grok: 'https://api.x.ai/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai'
}
const DEFAULT_MODEL: Record<Provider, string> = {
  anthropic: 'claude-opus-5',
  ollama: 'llama3.1',
  openai: 'gpt-4o',
  openrouter: 'meta-llama/llama-3.1-70b-instruct:free',
  gemini: 'gemini-2.0-flash',
  deepseek: 'deepseek-chat',
  grok: 'grok-2-latest',
  custom: 'default'
}

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

// Ollama local (I8: gratis y offline).
async function callOllama(system: string, prompt: string, model: string): Promise<Raw> {
  const r = await fetch('http://127.0.0.1:11434/api/generate', { method: 'POST', body: JSON.stringify({ model, system, prompt, stream: false }) })
  if (!r.ok) throw new Error(`Ollama respondió ${r.status}`)
  const j = (await r.json()) as { response: string; prompt_eval_count?: number; eval_count?: number }
  return { text: j.response, tokensIn: j.prompt_eval_count ?? estimateTokens(prompt), tokensOut: j.eval_count ?? estimateTokens(j.response), model }
}

// Cualquier proveedor compatible con OpenAI (OpenAI, OpenRouter, Gemini, DeepSeek, Grok, Custom).
async function callOpenAICompat(provider: Provider, cfg: ProjectConfig, system: string, prompt: string, model: string): Promise<Raw> {
  const base = (provider === 'custom' ? cfg.byok.baseUrl : OPENAI_COMPAT[provider])?.replace(/\/$/, '')
  if (!base) throw new Error(`Sin URL base para ${provider}`)
  const apiKey = getKey(provider)
  if (!apiKey && provider !== 'custom') throw new Error(`Sin clave BYOK para ${provider}`)
  const r = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
    body: JSON.stringify({ model, max_tokens: 32000, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] })
  })
  if (!r.ok) throw new Error(`${provider} respondió ${r.status}: ${(await r.text()).slice(0, 200)}`)
  const j = (await r.json()) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } }
  const text = j.choices?.[0]?.message?.content ?? ''
  if (!text) throw new Error(`${provider} no devolvió texto`)
  return { text, tokensIn: j.usage?.prompt_tokens ?? estimateTokens(prompt), tokensOut: j.usage?.completion_tokens ?? estimateTokens(text), model }
}

async function call(cfg: ProjectConfig, system: string, prompt: string): Promise<Raw> {
  const provider = cfg.byok.provider
  const model = cfg.byok.model || DEFAULT_MODEL[provider] || 'default'
  try {
    const r = provider === 'anthropic' ? await callAnthropic(system, prompt, model)
      : provider === 'ollama' ? await callOllama(system, prompt, model)
      : await callOpenAICompat(provider, cfg, system, prompt, model)
    logUsage({ provider, model: r.model, tokensIn: r.tokensIn, tokensOut: r.tokensOut, ok: true })
    return r
  } catch (e) {
    logUsage({ provider, model, tokensIn: 0, tokensOut: 0, ok: false })
    throw e
  }
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

export async function aiText(instruction: string, context: string, cfg: ProjectConfig): Promise<AiText> {
  const system = 'Eres un desarrollador de personajes y guiones. Responde solo con el texto pedido, sin preámbulos ni formato Markdown.'
  return call(cfg, system, `CONTEXTO:\n${context}\n\nPETICIÓN:\n${instruction}`)
}

// Documentos de desarrollo (Nivel 2): logline, sinopsis, treatment a partir del guion.
const DEVDOC: Record<string, string> = {
  logline: 'Escribe UNA logline (1-2 frases) que capture protagonista, conflicto y lo que está en juego. Solo la logline.',
  sinopsis: 'Escribe una sinopsis de 1 a 3 párrafos: planteamiento, desarrollo y desenlace, sin listar escena por escena.',
  treatment: 'Escribe un treatment en prosa presente, por secuencias, cubriendo toda la historia con su arco dramático. Usa subtítulos por acto si ayuda.'
}
export async function devDoc(kind: string, text: string, cfg: ProjectConfig): Promise<AiText> {
  const system = 'Eres un consultor de desarrollo de guion. Escribe en el mismo idioma del guion, en prosa profesional, sin preámbulos.'
  const instr = DEVDOC[kind] ?? kind
  return call(cfg, system, `GUION:\n${text}\n\nTAREA:\n${instr}`)
}

// Script Doctor con IA (Nivel 2): informe crítico en Markdown, además de las heurísticas locales.
export async function doctorAi(text: string, focus: string, cfg: ProjectConfig): Promise<AiText> {
  const system = 'Eres un script doctor profesional. Devuelve un informe en Markdown claro y accionable, en el idioma del guion. Sé concreto y cita escenas cuando puedas. No reescribas el guion.'
  const areas = focus.trim() || 'estructura, ritmo, personajes, diálogo, claridad y coherencia'
  return call(cfg, system, `GUION:\n${text}\n\nENCARGO: Diagnostica el guion enfocándote en: ${areas}. Estructura el informe con secciones y viñetas.`)
}

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
