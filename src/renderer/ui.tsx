import { useEffect, useMemo, useState } from 'react'
import { readFrontmatter } from '../core/frontmatter'
import { parseFountain } from '../core/parser/fountain'
import { project, type Projection } from '../core/projection'
import type { Doc } from '../core/types/ipc'
import { t } from './i18n'
import { useStore } from './store'

// Piezas compartidas entre vistas.

export function useAsset(rel: string): string {
  const [url, setUrl] = useState('')
  useEffect(() => {
    let live = true
    if (!rel) setUrl('')
    else void window.api.assetRead(rel).then((u) => live && setUrl(u))
    return () => {
      live = false
    }
  }, [rel])
  return url
}

export const useDoc = (path: string | null): Doc | undefined => useStore((s) => s.docs.find((d) => d.path === path))

export function useProjection(path: string | null): Projection {
  const doc = useDoc(path)
  return useMemo(() => project(parseFountain(doc?.content ?? '')), [doc?.content])
}

export const fm = (doc: Doc | undefined) => (doc ? readFrontmatter(doc.content).data : {})

// Iconos SVG inline (no emoji). Heredan color (currentColor) y tamaño 1em.
const PATHS: Record<string, string> = {
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  expand: 'M4 9V4h5M20 15v5h-5M15 4h5v5M9 20H4v-5',
  question: 'M9 9a3 3 0 1 1 4 2.8c-.8.4-1 1-1 2M12 17h.01',
  dice: 'M4 4h16v16H4zM8 8h.01M16 8h.01M8 16h.01M16 16h.01M12 12h.01',
  actor: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 20a7 7 0 0 1 14 0',
  book: 'M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 20l-4-4',
  timer: 'M12 8v5l3 2M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM9 2h6',
  note: 'M5 3h10l4 4v14H5zM15 3v4h4M8 12h8M8 16h5',
  minus: 'M5 12h14',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  check: 'M5 12l5 5L20 7',
  play: 'M8 5v14l11-7z',
  pause: 'M7 5v14M17 5v14',
  panel: 'M3 5h18v14H3zM15 5v14'
}
export function Icon({ name, size = 16 }: { name: keyof typeof PATHS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }} aria-hidden>
      {PATHS[name]!.split('M').filter(Boolean).map((d, i) => <path key={i} d={'M' + d} />)}
    </svg>
  )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

// Texto que se guarda al salir del campo (evita una escritura por tecla).
export function BlurInput({ value, onCommit, textarea, placeholder, rows }: { value: string; onCommit: (v: string) => void; textarea?: boolean; placeholder?: string; rows?: number }) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  const commit = () => v !== value && onCommit(v)
  return textarea ? (
    <textarea value={v} rows={rows ?? 3} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={commit} />
  ) : (
    <input value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} />
  )
}

export function EpisodeSelect({ value, onChange }: { value: string | null; onChange: (p: string) => void }) {
  const files = useStore((s) => s.files)
  const scripts = files.filter((f) => f.kind === 'script')
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">— {t('episodio')} —</option>
      {scripts.map((f) => (
        <option key={f.path} value={f.path}>{f.name}</option>
      ))}
    </select>
  )
}

// Propuesta de IA para un campo de texto: se muestra y el usuario acepta o rechaza (I2).
export function AiSuggest({ instruction, context, onAccept }: { instruction: string; context: string; onAccept: (t: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [text, setText] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const run = async () => {
    setBusy(true)
    setErr('')
    try {
      setText((await window.api.aiText(instruction, context)).text.trim())
    } catch (e) {
      setErr(String(e).replace(/^Error: (Error invoking remote method '[^']+': )?(Error: )?/, ''))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="suggest">
      <button className="mini ghost" disabled={busy} onClick={() => void run()}>{busy ? '…' : `✦ ${t('Sugerir con IA')}`}</button>
      {err && <span className="err">{err}</span>}
      {text !== null && (
        <div className="proposal">
          <p>{text}</p>
          <div className="row">
            <button className="mini" onClick={() => { onAccept(text); setText(null) }}>{t('Aceptar')}</button>
            <button className="mini ghost" onClick={() => setText(null)}>{t('Rechazar')}</button>
          </div>
        </div>
      )}
    </div>
  )
}
