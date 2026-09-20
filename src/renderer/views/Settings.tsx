import { useEffect, useState } from 'react'
import { validateTags } from '../../core/tags'
import { DEFAULT_PROMPTS, type ProjectConfig, type Provider, type UsageStats } from '../../core/types/ipc'
import { useStore } from '../store'
import { Field, useAsset } from '../ui'

const PROVIDERS: [Provider, string][] = [
  ['anthropic', 'Anthropic (Claude)'], ['openai', 'OpenAI (GPT)'], ['openrouter', 'OpenRouter (modelos gratis)'],
  ['gemini', 'Google (Gemini)'], ['deepseek', 'DeepSeek'], ['grok', 'Grok (xAI)'], ['ollama', 'Ollama (local)'], ['custom', 'Custom (compatible OpenAI)']
]
const NEEDS_KEY = (p: Provider) => p !== 'ollama'

export function Settings() {
  const { vault, keyStatus, saveKey, saveConfig } = useStore()
  const [c, setC] = useState<ProjectConfig | null>(vault?.config ?? null)
  const [key, setKey] = useState('')
  const [usage, setUsage] = useState<UsageStats | null>(null)
  useEffect(() => setC(vault?.config ?? null), [vault])
  useEffect(() => { void window.api.usageGet().then(setUsage) }, [vault])
  const cover = useAsset(c?.cover.image ?? '')
  if (!c) return <main className="page"><p className="muted">Abre un vault.</p></main>
  const issues = validateTags(c.tags)
  const set = <K extends keyof ProjectConfig>(k: K, v: Partial<ProjectConfig[K]>) => setC({ ...c, [k]: { ...c[k], ...v } })

  return (
    <main className="page scroll settings">
      <div className="toolbar"><strong>Ajustes del proyecto</strong><span className="muted tiny">.narrative/project.yaml</span><span className="grow" /><button onClick={() => void saveConfig(c)}>Guardar</button></div>
      <div className="grid2">
        <div className="panelbox">
          <h2>IA y API (BYOK)</h2>
          <Field label="Proveedor">
            <select value={c.byok.provider} onChange={(e) => set('byok', { provider: e.target.value as Provider })}>
              {PROVIDERS.map(([p, l]) => <option key={p} value={p}>{l}</option>)}
            </select>
          </Field>
          {c.byok.provider === 'custom' && (
            <Field label="URL base (compatible OpenAI)"><input value={c.byok.baseUrl ?? ''} placeholder="http://localhost:1234/v1" onChange={(e) => set('byok', { baseUrl: e.target.value || undefined })} /></Field>
          )}
          <Field label="Modelo"><input value={c.byok.model ?? ''} placeholder="por defecto del proveedor" onChange={(e) => set('byok', { model: e.target.value || undefined })} /></Field>
          {NEEDS_KEY(c.byok.provider) && (
            <Field label={`Clave · ${keyStatus?.present ? 'guardada en el keychain del SO' : 'sin clave'}`}>
              <input type="password" placeholder="Pegar clave y Enter" value={key} onChange={(e) => setKey(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { void saveKey(key); setKey('') } }} />
            </Field>
          )}
          <p className="muted tiny">La clave se guarda en el keychain del SO por proveedor; nunca en el vault ni en el renderer. {c.byok.provider === 'openrouter' && 'OpenRouter da modelos gratis (usa uno que termine en :free).'}</p>
        </div>
        <div className="panelbox">
          <h2>Uso de IA <button className="mini ghost" onClick={() => void window.api.usageReset().then(() => window.api.usageGet().then(setUsage))}>Reiniciar</button></h2>
          {!usage || usage.calls === 0 ? <p className="muted">Sin llamadas registradas todavía.</p> : (
            <>
              <div className="row tiny"><span>{usage.calls} llamadas</span><span className="grow" /><span>{usage.fails} fallos</span></div>
              <div className="row tiny"><span>≈ {usage.tokensIn.toLocaleString()} tokens enviados</span><span className="grow" /><span>≈ {usage.tokensOut.toLocaleString()} recibidos</span></div>
              <table className="table"><thead><tr><th>Modelo</th><th>Llamadas</th><th>Tokens</th></tr></thead>
                <tbody>{usage.byModel.slice(0, 8).map((m) => <tr key={m.model}><td>{m.model}</td><td>{m.calls}</td><td>{(m.tokensIn + m.tokensOut).toLocaleString()}</td></tr>)}</tbody>
              </table>
              <p className="muted tiny">Local, en .narrative/usage.log. Nunca incluye la clave.</p>
            </>
          )}
        </div>
        <div className="panelbox">
          <h2>Mapa de tags</h2>
          <Field label="Enlace a entidad"><input value={c.tags.entity_link} onChange={(e) => set('tags', { entity_link: e.target.value })} /></Field>
          <Field label="Nota de guionista"><input value={c.tags.note} onChange={(e) => set('tags', { note: e.target.value })} /></Field>
          {issues.map((i, k) => <p key={k} className={i.level === 'error' ? 'err' : 'warn'}>{i.message}</p>)}
          <h2>Graphify</h2>
          <label className="check"><input type="checkbox" checked={c.graphify.enabled} onChange={(e) => set('graphify', { enabled: e.target.checked })} /> Usar Graphify si está instalado</label>
          <Field label="Pase semántico">
            <select value={c.graphify.semantic_pass} onChange={(e) => set('graphify', { semantic_pass: e.target.value as ProjectConfig['graphify']['semantic_pass'] })}>
              <option value="off">off</option><option value="opt-in">opt-in</option><option value="on">on</option>
            </select>
          </Field>
        </div>
        <div className="panelbox">
          <h2>Portada del PDF</h2>
          <Field label="Título"><input value={c.cover.title} onChange={(e) => set('cover', { title: e.target.value })} /></Field>
          <Field label="Autor"><input value={c.cover.author} onChange={(e) => set('cover', { author: e.target.value })} /></Field>
          <Field label="Contacto"><textarea rows={2} value={c.cover.contact} onChange={(e) => set('cover', { contact: e.target.value })} /></Field>
          <Field label="Borrador / fecha"><input value={c.cover.draft} onChange={(e) => set('cover', { draft: e.target.value })} /></Field>
          <div className="row">
            <button className="ghost" onClick={() => void window.api.assetPick().then((rel) => rel && set('cover', { image: rel }))}>Imagen…</button>
            {c.cover.image && <button className="mini ghost" onClick={() => set('cover', { image: '' })}>quitar</button>}
          </div>
          <Field label="Papel">
            <select value={c.pdf.paper} onChange={(e) => set('pdf', { paper: e.target.value as 'Letter' | 'A4' })}><option>Letter</option><option>A4</option></select>
          </Field>
        </div>
        <div className="panelbox preview">
          <h2>Vista previa</h2>
          <div className="paper">
            {cover && <img src={cover} alt="" />}
            <div className="ct">{c.cover.title || 'Título'}</div>
            <div>by</div>
            <div className="au">{c.cover.author || 'Autor'}</div>
            <div className="ft"><span>{c.cover.contact}</span><span>{c.cover.draft}</span></div>
          </div>
        </div>
        <div className="panelbox wide">
          <h2>Prompts <button className="mini ghost" onClick={() => set('prompts', DEFAULT_PROMPTS)}>restaurar</button></h2>
          <Field label="Script Assistant"><textarea rows={5} value={c.prompts.assistant} onChange={(e) => set('prompts', { assistant: e.target.value })} /></Field>
          <Field label="Análisis"><textarea rows={5} value={c.prompts.analysis} onChange={(e) => set('prompts', { analysis: e.target.value })} /></Field>
        </div>
      </div>
    </main>
  )
}
