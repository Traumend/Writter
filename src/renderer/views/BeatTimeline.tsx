import { useEffect, useRef, useState } from 'react'
import { readFrontmatter, writeFrontmatter } from '../../core/frontmatter'
import { useStore } from '../store'
import { BlurInput, EpisodeSelect, useDoc, useProjection } from '../ui'
import { TEMPLATE } from './Desk'

type Act = { title: string; summary: string; from: number; to: number }
type Beat = { id: string; title: string; note: string; scene: number; kind: string }
type Note = { id: string; text: string; x: number; y: number; color: string }
const KINDS: Record<string, string> = { setup: '#4f8cff', payoff: '#3ddc97', twist: '#c47d1a', climax: '#e8437f', surprise: '#b388ff', romance: '#ff8fb1', other: '#8b91a0' }
const COLORS = ['#3a2a10', '#102a3a', '#2a103a', '#10331d', '#3a1020']
const uid = () => Math.random().toString(36).slice(2, 8)

export function BeatTimeline() {
  const { files, openFile, setTab, createFile, writeOther } = useStore()
  const scripts = files.filter((f) => f.kind === 'script')
  const [ep, setEp] = useState<string | null>(scripts[0]?.path ?? null)
  const script = ep ?? scripts[0]?.path ?? null
  const proj = useProjection(script)
  const scriptDoc = useDoc(script)
  const outlinePath = script ? `outline/${script.split('/').pop()!}` : null
  const outline = useDoc(outlinePath)
  const [selScene, setSelScene] = useState<number | null>(null)
  const wall = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (outlinePath && !files.some((f) => f.path === outlinePath)) void createFile(outlinePath, TEMPLATE.outline(outlinePath), false)
  }, [outlinePath, files, createFile])

  const data = outline ? readFrontmatter(outline.content).data : {}
  const acts = (Array.isArray(data['acts']) ? data['acts'] : []) as Act[]
  const beats = (Array.isArray(data['beats']) ? data['beats'] : []) as Beat[]
  const notes = (Array.isArray(data['notes']) ? data['notes'] : []) as Note[]
  const save = (p: Record<string, unknown>) => outline && void writeOther(outline.path, writeFrontmatter(outline.content, p))
  const n = Math.max(1, proj.scenes.length)
  const pct = (i: number) => `${(i / n) * 100}%`

  // Arrastre de notas: pointer events, posición relativa al muro.
  const drag = (id: string) => (e: React.PointerEvent) => {
    const el = wall.current
    if (!el || (e.target as HTMLElement).tagName === 'TEXTAREA') return
    const note = notes.find((x) => x.id === id)!
    const sx = e.clientX - note.x, sy = e.clientY - note.y
    const move = (ev: PointerEvent) => {
      const target = el.querySelector<HTMLElement>(`[data-id="${id}"]`)
      if (target) { target.style.left = `${ev.clientX - sx}px`; target.style.top = `${ev.clientY - sy}px` }
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      save({ notes: notes.map((x) => (x.id === id ? { ...x, x: Math.max(0, ev.clientX - sx), y: Math.max(0, ev.clientY - sy) } : x)) })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const sceneLines = selScene !== null && scriptDoc ? scriptDoc.content.split('\n').slice(proj.scenes[selScene]?.startLine, proj.scenes[selScene]?.endLine) : []

  return (
    <main className="page">
      <div className="toolbar">
        <EpisodeSelect value={script} onChange={setEp} />
        <span className="muted">{proj.scenes.length} escenas · {acts.length} actos · {beats.length} beats</span>
        <span className="grow" />
        <button className="ghost" onClick={() => save({ acts: [...acts, { title: `Acto ${acts.length + 1}`, summary: '', from: 0, to: n - 1 }] })}>+ Acto</button>
        <button className="ghost" onClick={() => save({ beats: [...beats, { id: uid(), title: 'Nuevo beat', note: '', scene: selScene ?? 0, kind: 'setup' }] })}>+ Beat</button>
        <button className="ghost" onClick={() => save({ notes: [...notes, { id: uid(), text: '', x: 20 + notes.length * 30, y: 20 + notes.length * 20, color: COLORS[notes.length % COLORS.length]! }] })}>+ Nota</button>
      </div>
      <div className="timeline">
        <div className="lane">
          <div className="lanelabel">Actos</div>
          <div className="track">
            {acts.map((a, i) => (
              <div className="act" key={i} style={{ left: pct(a.from), width: pct(Math.max(1, a.to - a.from + 1)) }}>
                <div className="row">
                  <BlurInput value={a.title} onCommit={(v) => save({ acts: acts.map((x, j) => (j === i ? { ...x, title: v } : x)) })} />
                  <input type="number" min={1} max={n} value={a.from + 1} title="desde escena" onChange={(e) => save({ acts: acts.map((x, j) => (j === i ? { ...x, from: Number(e.target.value) - 1 } : x)) })} />
                  <input type="number" min={1} max={n} value={a.to + 1} title="hasta escena" onChange={(e) => save({ acts: acts.map((x, j) => (j === i ? { ...x, to: Number(e.target.value) - 1 } : x)) })} />
                  <button className="mini ghost" onClick={() => save({ acts: acts.filter((_, j) => j !== i) })}>×</button>
                </div>
                <BlurInput textarea rows={2} value={a.summary} placeholder="Resumen del acto" onCommit={(v) => save({ acts: acts.map((x, j) => (j === i ? { ...x, summary: v } : x)) })} />
              </div>
            ))}
          </div>
        </div>
        <div className="lane">
          <div className="lanelabel">Beats</div>
          <div className="track beats">
            {beats.map((b) => (
              <div className="beat" key={b.id} style={{ left: pct(b.scene) }}>
                <div className="row">
                  <span className="dot" title={b.kind} style={{ background: KINDS[b.kind] ?? KINDS['other'] }} />
                  <select value={b.kind} onChange={(e) => save({ beats: beats.map((x) => (x.id === b.id ? { ...x, kind: e.target.value } : x)) })}>{Object.keys(KINDS).map((k) => <option key={k}>{k}</option>)}</select>
                  <select value={b.scene} onChange={(e) => save({ beats: beats.map((x) => (x.id === b.id ? { ...x, scene: Number(e.target.value) } : x)) })}>{proj.scenes.map((s) => <option key={s.index} value={s.index}>#{s.index + 1}</option>)}</select>
                  <button className="mini ghost" onClick={() => save({ beats: beats.filter((x) => x.id !== b.id) })}>×</button>
                </div>
                <BlurInput value={b.title} onCommit={(v) => save({ beats: beats.map((x) => (x.id === b.id ? { ...x, title: v } : x)) })} />
                <BlurInput textarea rows={2} value={b.note} placeholder="Nota" onCommit={(v) => save({ beats: beats.map((x) => (x.id === b.id ? { ...x, note: v } : x)) })} />
              </div>
            ))}
          </div>
        </div>
        <div className="lane">
          <div className="lanelabel">Escenas</div>
          <div className="track scenesrow">
            {proj.scenes.map((s) => (
              <div key={s.index} className={`scenechip ${selScene === s.index ? 'on' : ''}`} style={{ width: pct(1) }} onClick={() => setSelScene(s.index)} title={s.heading}>
                <b>#{s.index + 1}</b> {s.heading.replace(/^(INT|EXT)[.\s]+/i, '').slice(0, 18)}
              </div>
            ))}
          </div>
        </div>
        <div className="wallwrap">
          <div className="wall" ref={wall}>
            {notes.map((nt) => (
              <div key={nt.id} data-id={nt.id} className="note" style={{ left: nt.x, top: nt.y, background: nt.color }} onPointerDown={drag(nt.id)}>
                <div className="row">
                  {COLORS.map((c) => <span key={c} className="dot" style={{ background: c }} onClick={() => save({ notes: notes.map((x) => (x.id === nt.id ? { ...x, color: c } : x)) })} />)}
                  <span className="grow" />
                  <button className="mini ghost" onClick={() => save({ notes: notes.filter((x) => x.id !== nt.id) })}>×</button>
                </div>
                <BlurInput textarea rows={4} value={nt.text} placeholder="Idea…" onCommit={(v) => save({ notes: notes.map((x) => (x.id === nt.id ? { ...x, text: v } : x)) })} />
              </div>
            ))}
            {notes.length === 0 && <p className="muted center">Muro creativo: añade notas y arrástralas.</p>}
          </div>
          {selScene !== null && proj.scenes[selScene] && (
            <aside className="inspector">
              <div className="row"><strong>#{selScene + 1} {proj.scenes[selScene]!.heading}</strong><span className="grow" /><button className="mini ghost" onClick={() => setSelScene(null)}>×</button></div>
              <div className="muted tiny">{proj.scenes[selScene]!.characters.join(', ')} · {proj.scenes[selScene]!.wordCount} palabras</div>
              <pre className="scenetext">{sceneLines.join('\n')}</pre>
              <button onClick={() => { void openFile(script!, proj.scenes[selScene]!.startLine); setTab('desk') }}>Abrir en Escritorio</button>
            </aside>
          )}
        </div>
      </div>
    </main>
  )
}
