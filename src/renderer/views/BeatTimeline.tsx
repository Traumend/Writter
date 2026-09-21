import { useEffect, useMemo, useRef, useState } from 'react'
import { breakdown } from '../../core/breakdown'
import { readFrontmatter, writeFrontmatter } from '../../core/frontmatter'
import { sceneMinutes } from '../../core/paginate'
import { parseFountain } from '../../core/parser/fountain'
import { project } from '../../core/projection'
import { t } from '../i18n'
import { useStore } from '../store'
import { BlurInput, useDoc } from '../ui'
import { TEMPLATE } from './Desk'

type Act = { title: string; summary: string; from: number; to: number }
type Beat = { id: string; title: string; note: string; scene: number; kind: string }
type Note = { id: string; text: string; x: number; y: number; color: string; kind: string; links?: string[] }
const KINDS: Record<string, string> = { setup: '#4f8cff', payoff: '#3ddc97', twist: '#c47d1a', climax: '#e8437f', surprise: '#b388ff', romance: '#ff8fb1', other: '#8b91a0' }
const KIND_LABEL: Record<string, string> = { setup: 'Setup', payoff: 'Payoff', twist: 'Giro', climax: 'Clímax', surprise: 'Sorpresa', romance: 'Romance', other: 'Otro' }
const COLORS = ['#3a2a10', '#102a3a', '#2a103a', '#10331d', '#3a1020']
const uid = () => Math.random().toString(36).slice(2, 8)
const tc = (m: number) => { const s = Math.max(0, Math.round(m * 60)); const h = Math.floor(s / 3600); const mm = Math.floor((s % 3600) / 60); const ss = s % 60; return (h ? `${h}:` : '') + `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` }

// Plantillas de estructura (Apply preset): actos y/o beats colocados por fracción de escena.
const PRESETS: Record<string, { acts?: [string, number, number][]; beats?: [string, string, number][] }> = {
  '3 actos': { acts: [['Acto 1', 0, 0.25], ['Acto 2', 0.25, 0.75], ['Acto 3', 0.75, 1]] },
  'Save the Cat': { beats: [['Opening Image', 'setup', 0], ['Theme Stated', 'setup', 0.05], ['Set-Up', 'setup', 0.1], ['Catalyst', 'twist', 0.12], ['Debate', 'other', 0.18], ['Break into Two', 'twist', 0.25], ['B Story', 'romance', 0.3], ['Fun and Games', 'other', 0.35], ['Midpoint', 'climax', 0.5], ['Bad Guys Close In', 'twist', 0.6], ['All Is Lost', 'climax', 0.75], ['Dark Night of the Soul', 'other', 0.8], ['Break into Three', 'twist', 0.85], ['Finale', 'climax', 0.92], ['Final Image', 'payoff', 1] ] },
  'Viaje del héroe': { beats: [['Mundo ordinario', 'setup', 0], ['Llamada', 'twist', 0.1], ['Rechazo', 'other', 0.15], ['Mentor', 'setup', 0.2], ['Cruce del umbral', 'twist', 0.25], ['Pruebas y aliados', 'other', 0.4], ['Acercamiento', 'other', 0.55], ['Prueba suprema', 'climax', 0.65], ['Recompensa', 'payoff', 0.75], ['Camino de vuelta', 'twist', 0.85], ['Resurrección', 'climax', 0.92], ['Regreso con el elixir', 'payoff', 1] ] }
}

export function BeatTimeline() {
  const { files, docs, openFile, setTab, createFile, writeOther, openLinker } = useStore()
  const scripts = files.filter((f) => f.kind === 'script')
  const cards = useMemo(() => breakdown(files, docs).filter((c) => c.kind === 'character'), [files, docs])

  // Metadatos y runtime de cada guion (para carriles Temporada/Episodio y scope serie).
  const meta = useMemo(() => scripts.map((f) => {
    const d = docs.find((x) => x.path === f.path)
    const fm = d ? readFrontmatter(d.content).data : {}
    const doc = parseFountain(d?.content ?? '')
    const scenes = project(doc).scenes
    const mins = sceneMinutes(doc.tokens, scenes)
    return { path: f.path, name: f.name, season: String(fm['season'] ?? ''), episode: String(fm['episode'] ?? ''), scenes: scenes.length, runtime: mins.reduce((a, b) => a + b, 0) }
  }), [scripts, docs])

  const [ep, setEp] = useState<string | null>(scripts[0]?.path ?? null)
  const script = ep ?? scripts[0]?.path ?? null
  const scriptDoc = useDoc(script)
  const outlinePath = script ? `outline/${script.split('/').pop()!}` : null
  const outline = useDoc(outlinePath)
  const [selScene, setSelScene] = useState<number | null>(null)
  const [zoom, setZoom] = useState(1)
  const [play, setPlay] = useState(0)
  const [entFilter, setEntFilter] = useState<Set<string>>(new Set())
  const [linking, setLinking] = useState<string | null>(null)
  const [versions, setVersions] = useState<{ id: string; ts: number; label?: string; origin: string }[]>([])
  const wall = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (outlinePath && !files.some((f) => f.path === outlinePath)) void createFile(outlinePath, TEMPLATE.outline(outlinePath), false)
  }, [outlinePath, files, createFile])
  useEffect(() => { setSelScene(null); if (script) void window.api.versionList(script).then(setVersions) }, [script])

  const doc = useMemo(() => parseFountain(scriptDoc?.content ?? ''), [scriptDoc?.content])
  const proj = useMemo(() => project(doc), [doc])
  const mins = useMemo(() => sceneMinutes(doc.tokens, proj.scenes), [doc, proj])
  const starts = useMemo(() => { const a: number[] = []; let s = 0; for (const m of mins) { a.push(s); s += m } a.push(s); return a }, [mins])
  const total = starts[starts.length - 1] ?? 1
  const PXM = 16 * zoom
  const GUT = 84 // canalón izquierdo para las etiquetas de carril
  const x = (m: number) => GUT + m * PXM
  const width = Math.max(600, GUT + total * PXM)

  const data = outline ? readFrontmatter(outline.content).data : {}
  const acts = (Array.isArray(data['acts']) ? data['acts'] : []) as Act[]
  const beats = (Array.isArray(data['beats']) ? data['beats'] : []) as Beat[]
  const notes = (Array.isArray(data['notes']) ? data['notes'] : []) as Note[]
  const save = (p: Record<string, unknown>) => outline && void writeOther(outline.path, writeFrontmatter(outline.content, p))

  const applyPreset = (name: string) => {
    const p = PRESETS[name]; if (!p || !proj.scenes.length) return
    const n = proj.scenes.length
    const patch: Record<string, unknown> = {}
    if (p.acts) patch['acts'] = p.acts.map(([title, a, b]) => ({ title, summary: '', from: Math.round(a * (n - 1)), to: Math.round(b * (n - 1)) }))
    if (p.beats) patch['beats'] = [...beats, ...p.beats.map(([title, kind, f]) => ({ id: uid(), title, note: '', kind, scene: Math.round(f * (n - 1)) }))]
    save(patch)
  }

  const exportMarkers = () => {
    const rows = [
      ...acts.map((a) => ['ACT', tc(starts[a.from] ?? 0), a.title]),
      ...beats.map((b) => ['BEAT', tc(starts[b.scene] ?? 0), b.title]),
      ...proj.scenes.map((s, i) => ['SCENE', tc(starts[i] ?? 0), `#${i + 1} ${s.heading}`])
    ].sort((p, q) => p[1]!.localeCompare(q[1]!))
    const csv = 'type,timecode,name\n' + rows.map((r) => r.map((c) => `"${c!.replace(/"/g, '""')}"`).join(',')).join('\n')
    void window.api.exportText(csv, `${script?.split('/').pop()?.replace(/\.md$/, '')}-markers.csv`)
  }

  const drag = (id: string) => (e: React.PointerEvent) => {
    const el = wall.current
    if (!el || (e.target as HTMLElement).tagName === 'TEXTAREA' || linking) return
    const note = notes.find((x) => x.id === id)!
    const sx = e.clientX - note.x, sy = e.clientY - note.y
    const move = (ev: PointerEvent) => { const tg = el.querySelector<HTMLElement>(`[data-id="${id}"]`); if (tg) { tg.style.left = `${ev.clientX - sx}px`; tg.style.top = `${ev.clientY - sy}px` } }
    const up = (ev: PointerEvent) => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); save({ notes: notes.map((n) => (n.id === id ? { ...n, x: Math.max(0, ev.clientX - sx), y: Math.max(0, ev.clientY - sy) } : n)) }) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  const clickNote = (id: string) => {
    if (!linking) return
    if (linking === id) { setLinking(null); return }
    save({ notes: notes.map((n) => (n.id === linking ? { ...n, links: [...new Set([...(n.links ?? []), id])] } : n)) })
    setLinking(null)
  }

  const sceneAtPlay = proj.scenes.findIndex((_, i) => play >= (starts[i] ?? 0) && play < (starts[i + 1] ?? total))
  const written = proj.scenes.filter((s) => s.wordCount > 15).length
  const inFilter = (i: number) => !entFilter.size || proj.scenes[i]!.characters.some((c) => entFilter.has(c))
  const sceneLines = selScene !== null && scriptDoc ? scriptDoc.content.split('\n').slice(proj.scenes[selScene]?.startLine, proj.scenes[selScene]?.endLine) : []
  const ticks = useMemo(() => { const step = zoom > 1.6 ? 1 : zoom > 0.8 ? 2 : 5; const out: number[] = []; for (let m = 0; m <= total; m += step) out.push(m); return out }, [total, zoom])
  const noteById = new Map(notes.map((n) => [n.id, n]))

  // Sin guiones no hay línea de tiempo: la carpeta de la historia debe estar vinculada como "Guiones".
  if (!scripts.length) return (
    <main className="page bt">
      <p className="muted">{t('No hay guiones en el vault. Vincula la carpeta de tu historia (capítulos o episodios) como Guiones.')} <button className="mini ghost" onClick={openLinker}>{t('Vincular carpetas…')}</button></p>
    </main>
  )

  return (
    <main className="page bt">
      <div className="toolbar wrap">
        <select value={script ?? ''} onChange={(e) => setEp(e.target.value)} title={t('Episodio')}>
          {meta.map((m) => <option key={m.path} value={m.path}>{m.season ? `S${m.season}` : ''}{m.episode ? `E${m.episode} · ` : ''}{m.name}</option>)}
        </select>
        <select defaultValue="" onChange={(e) => { if (e.target.value) applyPreset(e.target.value); e.target.value = '' }} title={t('Aplicar plantilla')}>
          <option value="">{t('Aplicar plantilla…')}</option>
          {Object.keys(PRESETS).map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <button className="ghost mini" onClick={() => save({ beats: [...beats, { id: uid(), title: t('Nuevo beat'), note: '', scene: sceneAtPlay >= 0 ? sceneAtPlay : (selScene ?? 0), kind: 'setup' }] })}>+ {t('Beat')}</button>
        <button className="ghost mini" onClick={() => save({ notes: [...notes, { id: uid(), text: '', x: 20 + notes.length * 26, y: 20 + notes.length * 18, color: COLORS[notes.length % COLORS.length]!, kind: 'idea' }] })}>+ {t('Nota')}</button>
        <button className="ghost mini" onClick={() => save({ acts: [...acts, { title: `${t('Acto')} ${acts.length + 1}`, summary: '', from: 0, to: Math.max(0, proj.scenes.length - 1) }] })}>+ {t('Acto')}</button>
        <span className="sep" />
        <button className="mini ghost" onClick={() => setZoom((z) => Math.max(0.3, z - 0.2))}>−</button>
        <button className="mini ghost" onClick={() => setZoom((z) => Math.min(3, z + 0.2))}>+</button>
        <button className="mini ghost" onClick={() => setZoom(1)}>{t('Ajustar')}</button>
        <span className="grow" />
        <span className="muted tiny">{proj.scenes.length} {t('escenas')} · {beats.length} beats · {total.toFixed(1)}m · {t('escritas')} {written}/{proj.scenes.length}</span>
        <button className="mini ghost" onClick={exportMarkers}>{t('Exportar marcadores')}</button>
      </div>

      {/* Filtros por entidad: resalta escenas donde aparece (dato de breakdown). */}
      <div className="toolbar wrap tiny">
        <span className="muted">{t('Filtros')}:</span>
        {cards.slice(0, 12).map((c) => (
          <button key={c.path} className={entFilter.has(c.name) ? 'on mini' : 'ghost mini'} onClick={() => setEntFilter((s) => { const n = new Set(s); n.has(c.name) ? n.delete(c.name) : n.add(c.name); return n })}>{c.name} {c.appearances.length}</button>
        ))}
      </div>

      <div className="bt-scroll scroll">
        <div className="bt-lanes" style={{ width }}>
          {/* Regla de tiempo + playhead */}
          <div className="bt-ruler" style={{ width }} onPointerDown={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); const set = (cx: number) => setPlay(Math.max(0, Math.min(total, (cx - r.left - GUT) / PXM))); set(e.clientX); const mv = (ev: PointerEvent) => set(ev.clientX); const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up) }; window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up) }}>
            {ticks.map((m) => <span key={m} className="tick" style={{ left: x(m) }}>{tc(m)}</span>)}
            <div className="playhead" style={{ left: x(play) }}><span>{tc(play)}{sceneAtPlay >= 0 ? ` · #${sceneAtPlay + 1}` : ''}</span></div>
          </div>

          <div className="bt-lane"><span className="lanelabel">{t('Actos')}</span>
            {acts.map((a, i) => (
              <div className="bt-block act" key={i} style={{ left: x(starts[a.from] ?? 0), width: Math.max(60, x(starts[Math.min(a.to + 1, starts.length - 1)] ?? total) - x(starts[a.from] ?? 0)) }}>
                <div className="row"><BlurInput value={a.title} onCommit={(v) => save({ acts: acts.map((y, j) => (j === i ? { ...y, title: v } : y)) })} /><button className="mini ghost" onClick={() => save({ acts: acts.filter((_, j) => j !== i) })}>×</button></div>
                <BlurInput textarea rows={2} value={a.summary} placeholder={t('Resumen del acto')} onCommit={(v) => save({ acts: acts.map((y, j) => (j === i ? { ...y, summary: v } : y)) })} />
              </div>
            ))}
          </div>

          <div className="bt-lane"><span className="lanelabel">Beats</span>
            {beats.map((b) => (
              <div className="bt-beat" key={b.id} style={{ left: x((starts[b.scene] ?? 0) + (mins[b.scene] ?? 0) / 2), background: KINDS[b.kind] ?? KINDS['other'] }}>
                <div className="row">
                  <select value={b.kind} onChange={(e) => save({ beats: beats.map((x) => (x.id === b.id ? { ...x, kind: e.target.value } : x)) })}>{Object.keys(KINDS).map((k) => <option key={k} value={k}>{t(KIND_LABEL[k] ?? k)}</option>)}</select>
                  <select value={b.scene} onChange={(e) => save({ beats: beats.map((x) => (x.id === b.id ? { ...x, scene: Number(e.target.value) } : x)) })}>{proj.scenes.map((s, i) => <option key={i} value={i}>#{i + 1}</option>)}</select>
                  <button className="mini ghost" onClick={() => save({ beats: beats.filter((x) => x.id !== b.id) })}>×</button>
                </div>
                <BlurInput value={b.title} onCommit={(v) => save({ beats: beats.map((x) => (x.id === b.id ? { ...x, title: v } : x)) })} />
              </div>
            ))}
          </div>

          <div className="bt-lane scenes"><span className="lanelabel">{t('Escenas')}</span>
            {proj.scenes.map((s, i) => (
              <div key={i} className={`bt-scene ${selScene === i ? 'on' : ''} ${inFilter(i) ? '' : 'dim'}`} style={{ left: x(starts[i] ?? 0), width: Math.max(28, x(mins[i] ?? 0) - 2) }} onClick={() => setSelScene(i)} title={`${s.heading} · ${(mins[i] ?? 0).toFixed(1)}m`}>
                <b>#{i + 1}</b> <span className="ell">{s.heading.replace(/^(INT|EXT)[.\s]+/i, '').slice(0, 16)}</span>
                <span className="dur">{(mins[i] ?? 0).toFixed(1)}m</span>
              </div>
            ))}
          </div>
        </div>

        {/* Muro creativo con conexiones + nodos de entidad */}
        <div className="wall bt-wall" ref={wall}>
          <svg className="bt-links">
            {notes.flatMap((n) => (n.links ?? []).map((tid) => { const b = noteById.get(tid); return b ? <line key={n.id + tid} x1={n.x + 90} y1={n.y + 30} x2={b.x + 90} y2={b.y + 30} stroke="var(--accent)" strokeDasharray="4 3" /> : null }))}
          </svg>
          {notes.map((nt) => (
            <div key={nt.id} data-id={nt.id} className={`note ${linking === nt.id ? 'linking' : ''}`} style={{ left: nt.x, top: nt.y, background: nt.color }} onPointerDown={drag(nt.id)} onClick={() => clickNote(nt.id)}>
              <div className="row">
                {COLORS.map((c) => <span key={c} className="dot" style={{ background: c }} onClick={(e) => { e.stopPropagation(); save({ notes: notes.map((x) => (x.id === nt.id ? { ...x, color: c } : x)) }) }} />)}
                <span className="grow" />
                <button className="mini ghost" title={t('Conectar')} onClick={(e) => { e.stopPropagation(); setLinking(linking === nt.id ? null : nt.id) }}>∞</button>
                <button className="mini ghost" onClick={(e) => { e.stopPropagation(); save({ notes: notes.filter((x) => x.id !== nt.id) }) }}>×</button>
              </div>
              <BlurInput textarea rows={3} value={nt.text} placeholder={t('Idea…')} onCommit={(v) => save({ notes: notes.map((x) => (x.id === nt.id ? { ...x, text: v } : x)) })} />
            </div>
          ))}
          <div className="bt-entities">
            {cards.slice(0, 8).map((c) => (
              <div key={c.path} className="bt-entity">
                <strong className="ell">{c.name}</strong>
                <span className="muted tiny">{t('presente en')} {c.appearances.length} {t('escenas')}</span>
                <div className="row"><button className="mini ghost" onClick={() => { void openFile(c.path); setTab('dev') }}>{t('Ficha')}</button><button className="mini ghost" onClick={() => setTab('breakdown')}>Breakdown</button></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Leyenda de tipos de beat */}
      <div className="bt-legend tiny muted">
        {Object.entries(KIND_LABEL).map(([k, l]) => <span key={k}><span className="dot" style={{ background: KINDS[k] }} /> {t(l)}</span>)}
      </div>

      {/* Inspector de escena */}
      {selScene !== null && proj.scenes[selScene] && (
        <aside className="inspector bt-inspector">
          <div className="row"><strong>#{selScene + 1} {proj.scenes[selScene]!.heading}</strong><span className="grow" /><button className="mini ghost" onClick={() => setSelScene(null)}>×</button></div>
          {versions.length > 0 && (
            <select><option>{t('Versión actual')}</option>{versions.map((v) => <option key={v.id}>{new Date(v.ts).toLocaleDateString()} · {v.label ?? v.origin}</option>)}</select>
          )}
          <div className="bt-prog"><div style={{ width: `${Math.round((written / Math.max(1, proj.scenes.length)) * 100)}%` }} /></div>
          <div className="muted tiny">{proj.scenes[selScene]!.characters.join(', ')} · {proj.scenes[selScene]!.wordCount} {t('palabras')} · {(mins[selScene] ?? 0).toFixed(1)} {t('pág.')}</div>
          <pre className="scenetext">{sceneLines.join('\n')}</pre>
          <button onClick={() => { void openFile(script!, proj.scenes[selScene]!.startLine); setTab('desk') }}>{t('Abrir en Escritorio')}</button>
        </aside>
      )}
    </main>
  )
}
