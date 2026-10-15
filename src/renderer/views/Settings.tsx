import { useEffect, useState } from 'react'
import { validateTags } from '../../core/tags'
import { estimateCost, fmtCost } from '../../core/ai/prices'
import { DEFAULT_PROMPTS, type AiTest, type BackupInfo, type ImageProvider, type KeyStatus, type ProjectConfig, type Provider, type UsageStats } from '../../core/types/ipc'
import { t } from '../i18n'
import { useStore } from '../store'
import { Field, useAsset } from '../ui'

const PROVIDERS: [Provider, string][] = [
  ['anthropic', 'Anthropic (Claude)'], ['openai', 'OpenAI (GPT)'], ['openrouter', 'OpenRouter (modelos gratis)'],
  ['gemini', 'Google (Gemini)'], ['deepseek', 'DeepSeek'], ['grok', 'Grok (xAI)'], ['ollama', 'Ollama (local)'], ['custom', 'Custom (compatible OpenAI)']
]
const NEEDS_KEY = (p: Provider) => p !== 'ollama'
const REASONING: Record<string, string> = { off: 'Apagado', low: 'Bajo', medium: 'Medio', high: 'Alto' }
const IMAGE_PROVIDERS: [ImageProvider, string][] = [['openai', 'OpenAI (gpt-image-1)'], ['grok', 'Grok (xAI)'], ['custom', 'Custom (compatible OpenAI)']]

// Imágenes del storyboard: proveedor aparte del de texto (Anthropic no genera imágenes), con su propia
// clave en el keychain del SO.
function ImageSettings({ c, set }: { c: ProjectConfig; set: (v: Partial<ProjectConfig['images']>) => void }) {
  const [key, setKey] = useState('')
  const [st, setSt] = useState<KeyStatus | null>(null)
  const p = c.images.provider
  useEffect(() => { void window.api.keysStatus(p).then(setSt) }, [p])
  return (
    <>
      <h2>{t('Imágenes del storyboard')}</h2>
      <Field label={t('Proveedor')}>
        <select value={p} onChange={(e) => set({ provider: e.target.value as ImageProvider })}>{IMAGE_PROVIDERS.map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}</select>
      </Field>
      {p === 'custom' && <Field label={t('URL base (compatible OpenAI)')}><input value={c.images.baseUrl ?? ''} placeholder="http://localhost:1234/v1" onChange={(e) => set({ baseUrl: e.target.value || undefined })} /></Field>}
      <Field label={t('Modelo')}><input value={c.images.model ?? ''} placeholder={t('por defecto del proveedor')} onChange={(e) => set({ model: e.target.value || undefined })} /></Field>
      <Field label={`${t('Clave')} · ${st?.present ? t('guardada en el keychain del SO') : t('sin clave')}`}>
        <input type="password" placeholder={t('Pegar clave y Enter')} value={key} onChange={(e) => setKey(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && key) { void window.api.keysSet(p, key).then(setSt); setKey('') } }} />
      </Field>
      <p className="muted tiny">{t('Si usas el mismo proveedor para texto e imágenes, la clave es la misma.')}</p>
    </>
  )
}

export function Settings() {
  const { vault, keyStatus, saveKey, saveConfig } = useStore()
  const [c, setC] = useState<ProjectConfig | null>(vault?.config ?? null)
  const [key, setKey] = useState('')
  const [usage, setUsage] = useState<UsageStats | null>(null)
  const [test, setTest] = useState<AiTest | null>(null)
  const [testing, setTesting] = useState(false)
  const [backup, setBackup] = useState<BackupInfo | null>(null)
  const [status, setStatus] = useState('')
  const [version, setVersion] = useState('')
  const days = (ts: number) => { const d = Math.floor((Date.now() - ts) / 86400000); return d <= 0 ? t('hoy') : `${t('hace')} ${d} ${t('día(s)')}` }
  useEffect(() => setC(vault?.config ?? null), [vault])
  useEffect(() => { void window.api.usageGet().then(setUsage) }, [vault])
  useEffect(() => { void window.api.appVersion().then(setVersion) }, [])
  const cover = useAsset(c?.cover.image ?? '')
  if (!c) return <main className="page"><p className="muted">{t('Abre un vault.')}</p></main>
  const issues = validateTags(c.tags)
  const set = <K extends keyof ProjectConfig>(k: K, v: Partial<ProjectConfig[K]>) => setC({ ...c, [k]: { ...c[k], ...v } })

  return (
    <main className="page scroll settings">
      <div className="toolbar"><strong>{t('Ajustes del proyecto')}</strong><span className="muted tiny">.narrative/project.yaml</span><span className="grow" />{status && <span className="muted tiny">{status}</span>}<button onClick={() => void saveConfig(c)}>{t('Guardar')}</button></div>
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
          <div className="row">
            <Field label={t('Máx. tokens')}><input type="number" min={256} max={200000} step={1024} value={c.byok.maxTokens ?? 32000} onChange={(e) => set('byok', { maxTokens: Number(e.target.value) || undefined })} /></Field>
            <Field label={t('Razonamiento')}>
              <select value={c.byok.reasoning ?? ''} onChange={(e) => set('byok', { reasoning: (e.target.value || undefined) as ProjectConfig['byok']['reasoning'] })}>
                <option value="">{t('por defecto del proveedor')}</option>
                {(['off', 'low', 'medium', 'high'] as const).map((r) => <option key={r} value={r}>{t(REASONING[r] ?? r)}</option>)}
              </select>
            </Field>
          </div>
          <div className="row">
            <button className="ghost" onClick={() => { setTesting(true); void window.api.aiTest().then((r) => { setTest(r); setTesting(false) }) }} disabled={testing}>{testing ? t('Probando…') : t('Probar conexión')}</button>
            {test && <span className={test.ok ? 'muted tiny' : 'err tiny'}>{test.ok ? `${t('Conectado')} · ${test.model} · ${test.ms} ms` : test.error}</span>}
          </div>
          <h2>{t('Cabeceras personalizadas')}</h2>
          <p className="muted tiny">{t('Para puertas de enlace o servidores propios. Nunca guardes aquí la clave si compartes el proyecto.')}</p>
          {(c.byok.headers ?? []).map((h, i) => (
            <div className="row" key={i}>
              <input value={h.name} placeholder="x-api-key" onChange={(e) => set('byok', { headers: (c.byok.headers ?? []).map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
              <input value={h.value} placeholder="valor" onChange={(e) => set('byok', { headers: (c.byok.headers ?? []).map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} />
              <button className="mini ghost" onClick={() => set('byok', { headers: (c.byok.headers ?? []).filter((_, j) => j !== i) })}>×</button>
            </div>
          ))}
          <button className="mini ghost" onClick={() => set('byok', { headers: [...(c.byok.headers ?? []), { name: '', value: '' }] })}>+ {t('cabecera')}</button>
          <p className="muted tiny">{t('La clave se guarda en el keychain del SO por proveedor; nunca en el vault ni en el renderer.')} {c.byok.provider === 'openrouter' && t('OpenRouter da modelos gratis (usa uno que termine en :free).')}</p>
          <ImageSettings c={c} set={(v) => set('images', v)} />
        </div>
        <div className="panelbox">
          <h2>{t('Legal y privacidad')}</h2>
          <ul className="bullets tiny">
            <li>{t('Todo tu contenido vive en esta carpeta de tu equipo. Writter no tiene servidor ni cuenta.')}</li>
            <li>{t('La IA es BYOK: solo se envía lo que eliges, a tu proveedor, con tu clave. Nada se manda automáticamente.')}</li>
            <li>{t('No hay telemetría ni analítica. El registro de IA es local y nunca guarda prompts ni claves.')}</li>
            <li>{t('Los respaldos y exportaciones los decides tú; no salen del equipo salvo que elijas una carpeta sincronizada.')}</li>
          </ul>
          <p className="muted tiny">Writter {version} · © {new Date().getFullYear()}</p>

          <h2 className="danger">{t('Zona de peligro')}</h2>
          <div className="col">
            <button className="ghost danger" onClick={() => { if (window.confirm(t('¿Borrar las claves de API guardadas en este equipo? Tendrás que volver a pegarlas.'))) void window.api.keysClear().then((n) => setStatus(`${n} ${t('clave(s) borradas')}`)) }}>{t('Borrar claves de API')}</button>
            <button className="ghost danger" onClick={() => { if (window.confirm(t('¿Vaciar el historial de uso de IA de este proyecto?'))) void window.api.usageReset().then(() => window.api.usageGet().then(setUsage)) }}>{t('Vaciar historial de IA')}</button>
            <button className="ghost danger" onClick={() => { if (window.confirm(t('¿Reiniciar las preferencias de interfaz (tema, paneles, pestañas)? Tus archivos no se tocan.'))) { localStorage.removeItem('writter.prefs'); location.reload() } }}>{t('Reiniciar preferencias de interfaz')}</button>
          </div>
          <p className="muted tiny">{t('Writter nunca borra tu carpeta de proyecto: si quieres eliminarla, hazlo desde el explorador de archivos.')}</p>
        </div>

        <div className="panelbox">
          <h2>{t('Respaldos')}</h2>
          <p className="muted tiny">{t('Una copia completa del vault en un ZIP: guiones, fichas, escaleta, historial y ajustes.')}</p>
          <div className="row">
            <button onClick={() => void window.api.backupNow().then((i) => i && setBackup(i))}>{t('Copia de seguridad ahora')}</button>
            <button className="ghost" onClick={() => void window.api.backupRestore().then((r) => r && setStatus(`${r.files} ${t('archivo(s) restaurados')}`))}>{t('Restaurar desde respaldo…')}</button>
          </div>
          {backup && <p className="muted tiny">{t('Última copia')}: {new Date(backup.ts).toLocaleString()} · {backup.files} {t('archivos')} · {(backup.bytes / 1048576).toFixed(1)} MB</p>}
          {!backup && c.backups.lastTs > 0 && <p className="muted tiny">{t('Última copia')}: {new Date(c.backups.lastTs).toLocaleString()} ({days(c.backups.lastTs)})</p>}
          {!backup && !c.backups.lastTs && <p className="muted tiny warn">{t('Este proyecto no se ha respaldado nunca.')}</p>}
          <h2>{t('Respaldo automático')}</h2>
          <div className="row">
            <button className="ghost" onClick={() => void window.api.backupPickFolder().then((f) => f && set('backups', { folder: f }))}>{c.backups.folder ? t('Cambiar carpeta') : t('Elegir carpeta…')}</button>
            <span className="muted tiny ell" title={c.backups.folder}>{c.backups.folder || t('sin carpeta')}</span>
          </div>
          <div className="row">
            <Field label={t('Frecuencia')}>
              <select value={c.backups.everyMinutes} onChange={(e) => set('backups', { everyMinutes: Number(e.target.value) })}>
                {[[0, 'Desactivado'], [10, 'Cada 10 min'], [15, 'Cada 15 min'], [30, 'Cada 30 min'], [60, 'Cada hora'], [1440, 'Cada día']].map(([v, l]) => <option key={String(v)} value={v}>{t(String(l))}</option>)}
              </select>
            </Field>
            <Field label={t('Copias que se conservan')}>
              <select value={c.backups.keep} onChange={(e) => set('backups', { keep: Number(e.target.value) })}>{[3, 5, 10, 20].map((n) => <option key={n} value={n}>{n}</option>)}</select>
            </Field>
          </div>
          <p className="muted tiny">{t('Elige una carpeta sincronizada (Drive, Dropbox, OneDrive) si quieres copia fuera del equipo. Las claves de API nunca viajan en el respaldo.')}</p>
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
              <h2>{t('Historial de llamadas')}</h2>
              <table className="table"><thead><tr><th>{t('Fecha')}</th><th>{t('Modelo')}</th><th>{t('Tokens')}</th><th>{t('Duración')}</th><th>{t('Coste aprox.')}</th></tr></thead>
                <tbody>{usage.recent.slice(0, 12).map((r, i) => (
                  <tr key={i} className={r.ok ? '' : 'err'}>
                    <td className="tiny">{new Date(r.ts).toLocaleString()}</td>
                    <td className="tiny ell">{r.model}</td>
                    <td className="tiny">{(r.tokensIn + r.tokensOut).toLocaleString()}</td>
                    <td className="tiny">{r.ms ? `${(r.ms / 1000).toFixed(1)} s` : '—'}</td>
                    <td className="tiny">{fmtCost(estimateCost(r.model, r.tokensIn, r.tokensOut))}</td>
                  </tr>
                ))}</tbody>
              </table>
              <p className="muted tiny">{t('Local, en .narrative/usage.log. Nunca incluye la clave.')} {t('El coste es una estimación con precios públicos aproximados.')}</p>
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
