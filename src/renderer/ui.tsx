import { useEffect, useMemo, useState } from 'react'
import { readFrontmatter } from '../core/frontmatter'
import { parseFountain } from '../core/parser/fountain'
import { project, type Projection } from '../core/projection'
import type { Doc } from '../core/types/ipc'
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
      <option value="">— episodio —</option>
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
      <button className="mini ghost" disabled={busy} onClick={() => void run()}>{busy ? '…' : '✦ Sugerir con IA'}</button>
      {err && <span className="err">{err}</span>}
      {text !== null && (
        <div className="proposal">
          <p>{text}</p>
          <div className="row">
            <button className="mini" onClick={() => { onAccept(text); setText(null) }}>Aceptar</button>
            <button className="mini ghost" onClick={() => setText(null)}>Rechazar</button>
          </div>
        </div>
      )}
    </div>
  )
}
