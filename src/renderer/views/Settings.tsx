import { useEffect, useState } from 'react'
import { validateTags } from '../../core/tags'
import { DEFAULT_PROMPTS, type ProjectConfig, type Provider, type UsageStats } from '../../core/types/ipc'
import { t } from '../i18n'
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
  if (!c) return <main className="page"><p className="muted">{t('Abre un vault.')}</p></main>
  const issues = validateTags(c.tags)
  const set = <K extends keyof ProjectConfig>(k: K, v: Partial<ProjectConfig[K]>) => setC({ ...c, [k]: { ...c[k], ...v } })

  return (
    <main className="page scroll settings">
      <div className="toolbar"><strong>{t('Ajustes del proyecto')}</strong><span className="muted tiny">.narrative/project.yaml</span><span className="grow" /><button onClick={() => void saveConfig(c)}>{t('Guardar')}</button></div>
      <div className="grid2">
        <div className="panelbox">
          <h2>{t('IA y API (BYOK)')}</h2>
          <Field label={t('Proveedor')}>
            <select value={c.byok.provider} onChange={(e) => set('byok', { provider: e.target.value as Provider })}>
              {PROVIDERS.map(([p, l]) => <option key={p} value={p}>{t(l)}</option>)}
            </select>
          </Field>
          {c.byok.provider === 'custom' && (
            <Field label={t('URL base (compatible OpenAI)')}><input value={c.byok.baseUrl ?? ''} placeholder="http://localhost:1234/v1" onChange={(e) => set('byok', { baseUrl: e.target.value || undefined })} /></Field>
          )}
          <Field label={t('Modelo')}><input value={c.byok.model ?? ''} placeholder={t('por defecto del proveedor')} onChange={(e) => set('byok', { model: e.target.value || undefined })} /></Field>
          {NEEDS_KEY(c.byok.provider) && (
            <Field label={`${t('Clave')} · ${keyStatus?.present ? t('guardada en el keychain del SO') : t('sin clave')}`}>
              <input type="password" placeholder={t('Pegar clave y Enter')} value={key} onChange={(e) => setKey(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { void saveKey(key); setKey('') } }} />
            </Field>
          )}
          <p className="muted tiny">{t('La clave se guarda en el keychain del SO por proveedor; nunca en el vault ni en el renderer.')} {c.byok.provider === 'openrouter' && t('OpenRouter da modelos gratis (usa uno que termine en :free).')}</p>
        </div>
        <div className="panelbox">
          <h2>{t('Uso de IA')} <button className="mini ghost" onClick={() => void window.api.usageReset().then(() => window.api.usageGet().then(setUsage))}>{t('Reiniciar')}</button></h2>
          {!usage || usage.calls === 0 ? <p className="muted">{t('Sin llamadas registradas todavía.')}</p> : (
            <>
              <div className="row tiny"><span>{usage.calls} {t('llamadas')}</span><span className="grow" /><span>{usage.fails} {t('fallos')}</span></div>
              <div className="row tiny"><span>≈ {usage.tokensIn.toLocaleString()} {t('tokens enviados')}</span><span className="grow" /><span>≈ {usage.tokensOut.toLocaleString()} {t('recibidos')}</span></div>
              <table className="table"><thead><tr><th>{t('Modelo')}</th><th>{t('Llamadas')}</th><th>{t('Tokens')}</th></tr></thead>
                <tbody>{usage.byModel.slice(0, 8).map((m) => <tr key={m.model}><td>{m.model}</td><td>{m.calls}</td><td>{(m.tokensIn + m.tokensOut).toLocaleString()}</td></tr>)}</tbody>
              </table>
              <p className="muted tiny">{t('Local, en .narrative/usage.log. Nunca incluye la clave.')}</p>
            </>
          )}
        </div>
        <div className="panelbox">
          <h2>{t('Mapa de tags')}</h2>
          <Field label={t('Enlace a entidad')}><input value={c.tags.entity_link} onChange={(e) => set('tags', { entity_link: e.target.value })} /></Field>
          <Field label={t('Nota de guionista')}><input value={c.tags.note} onChange={(e) => set('tags', { note: e.target.value })} /></Field>
          {issues.map((i, k) => <p key={k} className={i.level === 'error' ? 'err' : 'warn'}>{i.message}</p>)}
          <h2>Graphify</h2>
          <label className="check"><input type="checkbox" checked={c.graphify.enabled} onChange={(e) => set('graphify', { enabled: e.target.checked })} /> {t('Usar Graphify si está instalado')}</label>
          <Field label={t('Pase semántico')}>
            <select value={c.graphify.semantic_pass} onChange={(e) => set('graphify', { semantic_pass: e.target.value as ProjectConfig['graphify']['semantic_pass'] })}>
              <option value="off">off</option><option value="opt-in">opt-in</option><option value="on">on</option>
            </select>
          </Field>
        </div>
        <div className="panelbox">
          <h2>{t('Portada del PDF')}</h2>
          <Field label={t('Título')}><input value={c.cover.title} onChange={(e) => set('cover', { title: e.target.value })} /></Field>
          <Field label={t('Autor')}><input value={c.cover.author} onChange={(e) => set('cover', { author: e.target.value })} /></Field>
          <Field label={t('Contacto')}><textarea rows={2} value={c.cover.contact} onChange={(e) => set('cover', { contact: e.target.value })} /></Field>
          <Field label={t('Borrador / fecha')}><input value={c.cover.draft} onChange={(e) => set('cover', { draft: e.target.value })} /></Field>
          <div className="row">
            <button className="ghost" onClick={() => void window.api.assetPick().then((rel) => rel && set('cover', { image: rel }))}>{t('Imagen…')}</button>
            {c.cover.image && <button className="mini ghost" onClick={() => set('cover', { image: '' })}>{t('quitar')}</button>}
          </div>
          <div className="row">
            <Field label={t('Papel')}>
              <select value={c.pdf.paper} onChange={(e) => set('pdf', { paper: e.target.value as 'Letter' | 'A4' })}><option>Letter</option><option>A4</option></select>
            </Field>
            <Field label={t('Interlineado')}>
              <select value={c.pdf.lineSpacing} onChange={(e) => set('pdf', { lineSpacing: Number(e.target.value) })}>
                <option value={1}>{t('1.0 (estándar)')}</option><option value={1.15}>1.15</option><option value={1.5}>1.5</option>
              </select>
            </Field>
          </div>
          <Field label={t('Encabezado de página')}><input value={c.pdf.header} placeholder="{title} · {episode}" onChange={(e) => set('pdf', { header: e.target.value })} /></Field>
          <Field label={t('Pie de página')}><input value={c.pdf.footer} placeholder="{page} / {pages}" onChange={(e) => set('pdf', { footer: e.target.value })} /></Field>
          <Field label={t('Marca de agua')}><input value={c.pdf.watermark} placeholder={t('BORRADOR')} onChange={(e) => set('pdf', { watermark: e.target.value })} /></Field>
          <p className="muted tiny">{t('Variables:')} {'{title} {episode} {author} {date} {page} {pages}'}. {t('El encabezado y pie se aplican al exportar PDF.')}</p>
        </div>
        <div className="panelbox preview">
          <h2>{t('Vista previa')}</h2>
          <div className="paper">
            {cover && <img src={cover} alt="" />}
            <div className="ct">{c.cover.title || t('Título')}</div>
            <div>by</div>
            <div className="au">{c.cover.author || t('Autor')}</div>
            <div className="ft"><span>{c.cover.contact}</span><span>{c.cover.draft}</span></div>
          </div>
        </div>
        <div className="panelbox wide">
          <h2>Prompts <button className="mini ghost" onClick={() => set('prompts', DEFAULT_PROMPTS)}>{t('restaurar')}</button></h2>
          <Field label="Script Assistant"><textarea rows={5} value={c.prompts.assistant} onChange={(e) => set('prompts', { assistant: e.target.value })} /></Field>
          <Field label={t('Análisis')}><textarea rows={5} value={c.prompts.analysis} onChange={(e) => set('prompts', { analysis: e.target.value })} /></Field>
        </div>
      </div>
    </main>
  )
}
