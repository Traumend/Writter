import { useRef, useState } from 'react'
import { t } from '../../i18n'
import { cleanErr, useStore } from '../../store'
import { useOutlinePatch, useScripts } from './data'

// Resúmenes con IA por escena y por capítulo (ScriptWriterX spNotes). Son la memoria barata de la
// historia: la IA los lee en lugar del texto completo. Llegan como propuestas y solo se escriben
// los marcados, en una sola escritura (I2).
type Proposal = { heading: string; text: string; on: boolean }
const SCENE = 'Resume esta escena en 1-2 frases (30-60 palabras): qué pasa y qué cambia. En el idioma del guion, sin preámbulos.'
const CHAPTER = 'Resume este capítulo en un párrafo (60-120 palabras) a partir de los resúmenes de sus escenas: qué pasa y qué cambia para los personajes. En el idioma del guion, sin preámbulos.'

export function Summaries() {
  const scripts = useScripts()
  const docs = useStore((s) => s.docs)
  const patchOutline = useOutlinePatch()
  const [path, setPath] = useState(scripts[0]?.path ?? '')
  const [onlyEmpty, setOnlyEmpty] = useState(true)
  const [busy, setBusy] = useState(false)
  const [props, setProps] = useState<Proposal[]>([])
  const [chapter, setChapter] = useState<Proposal | null>(null)
  const [err, setErr] = useState('')
  const stop = useRef(false)
  const script = scripts.find((s) => s.path === path)

  const run = async () => {
    if (!script) return
    const lines = (docs.find((d) => d.path === script.path)?.content ?? '').split('\n')
    const todo = script.scenes.filter((s) => !onlyEmpty || !script.sceneMeta[s.heading]?.summary)
    stop.current = false
    setBusy(true); setErr(''); setProps([]); setChapter(null)
    const out: Proposal[] = []
    try {
      for (const s of todo) {
        if (stop.current) return
        const r = await window.api.aiText(SCENE, lines.slice(s.startLine, s.endLine).join('\n'))
        out.push({ heading: s.heading, text: r.text.trim(), on: true })
        setProps([...out])
      }
      if (stop.current) return
      const all = script.scenes.map((s, i) => `${i + 1}. ${s.heading}: ${out.find((p) => p.heading === s.heading)?.text ?? script.sceneMeta[s.heading]?.summary ?? ''}`).join('\n')
      const r = await window.api.aiText(CHAPTER, all)
      setChapter({ heading: script.name, text: r.text.trim(), on: true })
    } catch (e) {
      if (!stop.current) setErr(cleanErr(e))
    } finally {
      setBusy(false)
    }
  }
  const cancel = () => { stop.current = true; window.api.aiCancel() }

  const apply = async () => {
    if (!script) return
    const sceneMeta = { ...script.sceneMeta }
    for (const p of props) if (p.on) sceneMeta[p.heading] = { ...(sceneMeta[p.heading] ?? {}), summary: p.text }
    await patchOutline(script, chapter?.on ? { sceneMeta, summary: chapter.text } : { sceneMeta })
    setProps([]); setChapter(null)
  }
  const edit = (i: number, p: Partial<Proposal>) => setProps((xs) => xs.map((x, j) => (j === i ? { ...x, ...p } : x)))
  const accepted = props.filter((p) => p.on).length + (chapter?.on ? 1 : 0)

  return (
    <div className="panelbox summaries">
      <div className="toolbar wrap">
        <strong>{t('Resúmenes con IA')}</strong>
        <select value={path} onChange={(e) => setPath(e.target.value)} disabled={busy}>{scripts.map((s) => <option key={s.path} value={s.path}>{s.name}</option>)}</select>
        <label className="row tiny"><input type="checkbox" checked={onlyEmpty} onChange={(e) => setOnlyEmpty(e.target.checked)} disabled={busy} />{t('Solo escenas sin resumen')}</label>
        <span className="grow" />
        {busy ? <button className="mini ghost" onClick={cancel}>{t('Detener')} ({props.length})</button> : <button className="mini" disabled={!script} onClick={() => void run()}>{t('Generar')}</button>}
        {accepted > 0 && !busy && <button className="mini" onClick={() => void apply()}>{t('Aplicar aceptados')} ({accepted})</button>}
      </div>
      {err && <p className="err">{err}</p>}
      {chapter && (
        <label className="proposal">
          <span className="row"><input type="checkbox" checked={chapter.on} onChange={(e) => setChapter({ ...chapter, on: e.target.checked })} /><b>{t('Capítulo')}: {chapter.heading}</b></span>
          <textarea rows={4} value={chapter.text} onChange={(e) => setChapter({ ...chapter, text: e.target.value })} />
        </label>
      )}
      {props.map((p, i) => (
        <label key={p.heading + i} className="proposal">
          <span className="row"><input type="checkbox" checked={p.on} onChange={(e) => edit(i, { on: e.target.checked })} /><b>{p.heading}</b></span>
          <textarea rows={2} value={p.text} onChange={(e) => edit(i, { text: e.target.value })} />
        </label>
      ))}
      {!busy && !props.length && !chapter && <p className="muted tiny">{t('La IA propone un resumen por escena y uno del capítulo. Revisa, edita y aplica solo los que aceptes.')}</p>}
    </div>
  )
}
