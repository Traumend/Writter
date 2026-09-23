import Anthropic from '@anthropic-ai/sdk'
import { checkSafeguards, estimateTokens } from '../core/safeguards'
import type { AiProposal, AiRequest, AiText, Analysis, BreakdownItem, BreakdownProposal, ProjectConfig, Provider } from '../core/types/ipc'
import { getKey } from './keys'
import { logUsage } from './vault'

// Motor de IA. Solo main: aquí viven las claves y la red (I3). Nunca escribe al vault por su cuenta (I2).
type Raw = { text: string; tokensIn: number; tokensOut: number; model: string }

// Cancelación y progreso en vivo (ScriptWriterX §30): una llamada a la vez, cancelable desde la interfaz.
let current: AbortController | null = null
let progress: ((chars: number, done?: boolean) => void) | null = null
export const setAiProgress = (fn: ((chars: number, done?: boolean) => void) | null) => { progress = fn }
export function cancelAi(): void { current?.abort(); current = null }
const tick = (chars: number) => progress?.(chars)

// Ajustes del usuario con valores por defecto sensatos.
const limits = (cfg: ProjectConfig) => ({
  maxTokens: Math.max(256, Math.min(200000, Number(cfg.byok.maxTokens) || 32000)),
  reasoning: cfg.byok.reasoning && cfg.byok.reasoning !== 'off' ? cfg.byok.reasoning : undefined,
  headers: Object.fromEntries((cfg.byok.headers ?? []).filter((h) => h.name.trim()).map((h) => [h.name.trim(), h.value]))
})

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

async function callAnthropic(cfg: ProjectConfig, system: string, prompt: string, model: string): Promise<Raw> {
  const apiKey = getKey('anthropic')
  if (!apiKey) throw new Error('Sin clave BYOK para anthropic')
  const { maxTokens, reasoning } = limits(cfg)
  const client = new Anthropic({ apiKey })
  const stream = client.messages.stream(
    { model, max_tokens: maxTokens, system, output_config: { effort: reasoning ?? 'medium' }, messages: [{ role: 'user', content: prompt }] },
    { signal: current?.signal }
  )
  let chars = 0
  stream.on('text', (t) => tick((chars += t.length)))
  const msg = await stream.finalMessage()
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
  const { maxTokens, reasoning, headers } = limits(cfg)
  const r = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    signal: current?.signal,
    headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}), ...headers },
    body: JSON.stringify({
      model, max_tokens: maxTokens, stream: true, stream_options: { include_usage: true },
      ...(reasoning ? { reasoning_effort: reasoning } : {}),
      messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }]
    })
  })
  if (!r.ok) throw new Error(`${provider} respondió ${r.status}: ${(await r.text()).slice(0, 200)}`)
  if (!r.body) throw new Error(`${provider} no devolvió contenido`)
  // SSE: cada línea "data: {json}" trae un trozo; "[DONE]" cierra.
  const reader = r.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  let text = ''
  let usage: { prompt_tokens?: number; completion_tokens?: number } | undefined
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      const data = line.replace(/^data:\s*/, '').trim()
      if (!line.startsWith('data:') || !data || data === '[DONE]') continue
      try {
        const j = JSON.parse(data) as { choices?: { delta?: { content?: string } }[]; usage?: typeof usage }
        const piece = j.choices?.[0]?.delta?.content ?? ''
        if (piece) { text += piece; tick(text.length) }
        if (j.usage) usage = j.usage
      } catch { /* trozo partido entre lecturas: el siguiente bucle lo completa */ }
    }
  }
  if (!text) throw new Error(`${provider} no devolvió texto`)
  return { text, tokensIn: usage?.prompt_tokens ?? estimateTokens(prompt), tokensOut: usage?.completion_tokens ?? estimateTokens(text), model }
}

async function call(cfg: ProjectConfig, system: string, prompt: string): Promise<Raw> {
  const provider = cfg.byok.provider
  const model = cfg.byok.model || DEFAULT_MODEL[provider] || 'default'
  const t0 = Date.now()
  current = new AbortController()
  try {
    const r = provider === 'anthropic' ? await callAnthropic(cfg, system, prompt, model)
      : provider === 'ollama' ? await callOllama(system, prompt, model)
      : await callOpenAICompat(provider, cfg, system, prompt, model)
    logUsage({ provider, model: r.model, tokensIn: r.tokensIn, tokensOut: r.tokensOut, ok: true, ms: Date.now() - t0 })
    return r
  } catch (e) {
    logUsage({ provider, model, tokensIn: 0, tokensOut: 0, ok: false, ms: Date.now() - t0 })
    throw current?.signal.aborted ? new Error('Llamada cancelada') : e
  } finally {
    current = null
    progress?.(0, true)
  }
}

// Prueba de conexión (§30): una llamada mínima que confirma clave, URL y modelo.
export async function testAi(cfg: ProjectConfig): Promise<{ ok: boolean; model?: string; ms?: number; error?: string }> {
  const t0 = Date.now()
  try {
    const r = await call(cfg, 'Responde exactamente: OK', 'OK')
    return { ok: true, model: r.model, ms: Date.now() - t0 }
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, error: String(e instanceof Error ? e.message : e).slice(0, 300) }
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
    writing: Array.isArray(j.writing) ? j.writing.map(String) : [],
    format: Array.isArray(j.format) ? j.format.map(String) : [],
    scenes: (Array.isArray(j.scenes) ? j.scenes : []).map((s, i) => ({
      index: Number(s.index ?? i),
      summary: String(s.summary ?? ''),
      emotion: String(s.emotion ?? 'Neutral'),
      intensity: num(s.intensity),
      tension: num(s.tension),
      attention: num(s.attention),
      commercial: num(s.commercial),
      notes: Array.isArray(s.notes) ? s.notes.map(String) : []
    }))
  }
}

// Desglose con IA (ScriptWriterX §22): propone entidades y descripciones; el usuario aprueba una a una.
export async function breakdownAi(text: string, known: string[], cfg: ProjectConfig): Promise<BreakdownProposal> {
  const system = 'Eres un asistente de desglose de producción. Devuelve SOLO un objeto JSON con las claves characters, locations y props. '
    + 'Cada elemento: { "name": string en MAYÚSCULAS, "aliases": string[], "description": frase breve, "group": string opcional }. '
    + 'No inventes entidades que no aparezcan en el texto. Sin comentarios ni markdown.'
  const prompt = `GUION:
${text}

YA EXISTEN (no los repitas salvo para mejorar su descripción): ${known.join(', ') || '—'}`
  const r = await call(cfg, system, prompt)
  const m = /\{[\s\S]*\}/.exec(r.text)
  if (!m) throw new Error('El modelo no devolvió JSON')
  const j = JSON.parse(m[0]) as Record<string, unknown>
  const lower = new Set(known.map((k) => k.toLowerCase()))
  const take = (key: string, kind: BreakdownItem['kind']): BreakdownItem[] =>
    (Array.isArray(j[key]) ? (j[key] as Record<string, unknown>[]) : []).map((x) => ({
      kind,
      name: String(x['name'] ?? '').trim(),
      aliases: Array.isArray(x['aliases']) ? (x['aliases'] as unknown[]).map(String) : [],
      description: String(x['description'] ?? '').trim(),
      group: x['group'] ? String(x['group']) : undefined,
      exists: lower.has(String(x['name'] ?? '').trim().toLowerCase())
    })).filter((x) => x.name)
  return { items: [...take('characters', 'character'), ...take('locations', 'location'), ...take('props', 'prop')], model: r.model, tokensIn: r.tokensIn, tokensOut: r.tokensOut }
}
