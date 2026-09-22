import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { breakdown } from '../../core/breakdown'
import { readFrontmatter, writeFrontmatter } from '../../core/frontmatter'
import { sceneMinutes } from '../../core/paginate'
import { parseFountain } from '../../core/parser/fountain'
import { project, type Scene } from '../../core/projection'
import { nextActRange, pack } from '../../core/timeline'
import { t } from '../i18n'
import { useStore } from '../store'
import { Icon, BlurInput } from '../ui'
import { TEMPLATE, NoScripts } from './Desk'

// Beat Timeline v2: línea de tiempo plana (temporada · episodio · actos · beats · escenas) con tarjetas de solo lectura,
// empaquetado en subfilas cuando dos tarjetas comparten tiempo, inspector persistente para editar y muro de notas.
// Todo se guarda en outline/<episodio>.md (acts, beats, notes) — docs/plan-beat-timeline-v2.md.
type Act = { title: string; summary: string; from: number; to: number; color?: string }
type Beat = { id: string; title: string; note: string; scene: number; kind: string }
type Note = { id: string; title?: string; text: string; x: number; y: number; color: string; kind: string; tags?: string[]; links?: string[] }
type Ep = { path: string; outlinePath: string; outlineContent: string | null; name: string; season: string; episode: string; code: string; content: string; scenes: Scene[]; mins: number[]; starts: number[]; runtime: number; offset: number; acts: Act[]; beats: Beat[]; notes: Note[] }
type SelKind = 'act' | 'beat' | 'note' | 'scene'
type Sel = { kind: SelKind; ep: string; key: number | string } | null

const KINDS: Record<string, string> = { setup: '#4f8cff', payoff: '#3ddc97', twist: '#c47d1a', climax: '#e8437f', surprise: '#b388ff', romance: '#ff8fb1', other: '#8b91a0' }
const KIND_LABEL: Record<string, string> = { setup: 'Setup', payoff: 'Payoff', twist: 'Giro', climax: 'Clímax', surprise: 'Sorpresa', romance: 'Romance', other: 'Otro' }
const ACT_COLORS = ['#3d6fd6', '#d65f3d', '#3da97a', '#9b5fd6', '#d6a23d', '#3dbcd6']
const NOTE_COLORS = ['#3a2a10', '#102a3a', '#2a103a', '#10331d', '#3a1020']
const TAGS = ['idea', 'giro', 'tema', 'duda', 'setup', 'payoff']
const uid = () => Math.random().toString(36).slice(2, 8)
const tc = (m: number) => { const s = Math.max(0, Math.round(m * 60)); const h = Math.floor(s / 3600); const mm = Math.floor((s % 3600) / 60); const ss = s % 60; return (h ? `${h}:` : '') + `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` }
const GUT = 84 // canalón izquierdo para las etiquetas de carril
const BEAT_W = 150, NOTE_W = 210, NOTE_H = 140

// Plantillas de estructura (Apply preset): actos y/o beats colocados por fracción de escena.
const PRESETS: Record<string, { acts?: [string, number, number][]; beats?: [string, string, number][] }> = {
  '3 actos': { acts: [['Acto 1', 0, 0.25], ['Acto 2', 0.25, 0.75], ['Acto 3', 0.75, 1]] },
  'Save the Cat': { beats: [['Opening Image', 'setup', 0], ['Theme Stated', 'setup', 0.05], ['Set-Up', 'setup', 0.1], ['Catalyst', 'twist', 0.12], ['Debate', 'other', 0.18], ['Break into Two', 'twist', 0.25], ['B Story', 'romance', 0.3], ['Fun and Games', 'other', 0.35], ['Midpoint', 'climax', 0.5], ['Bad Guys Close In', 'twist', 0.6], ['All Is Lost', 'climax', 0.75], ['Dark Night of the Soul', 'other', 0.8], ['Break into Three', 'twist', 0.85], ['Finale', 'climax', 0.92], ['Final Image', 'payoff', 1] ] },
  'Viaje del héroe': { beats: [['Mundo ordinario', 'setup', 0], ['Llamada', 'twist', 0.1], ['Rechazo', 'other', 0.15], ['Mentor', 'setup', 0.2], ['Cruce del umbral', 'twist', 0.25], ['Pruebas y aliados', 'other', 0.4], ['Acercamiento', 'other', 0.55], ['Prueba suprema', 'climax', 0.65], ['Recompensa', 'payoff', 0.75], ['Camino de vuelta', 'twist', 0.85], ['Resurrección', 'climax', 0.92], ['Regreso con el elixir', 'payoff', 1] ] }
}

// Primera celda libre de la rejilla del muro para una nota nueva.
function freeSpot(notes: Note[]): { x: number; y: number } {
  for (let row = 0; row < 30; row++) for (let col = 0; col < 12; col++) {
    const x = 16 + col * NOTE_W, y = 16 + row * NOTE_H
    if (!notes.some((n) => Math.abs(n.x - x) < NOTE_W - 12 && Math.abs(n.y - y) < NOTE_H - 12)) return { x, y }
  }
  return { x: 16, y: 16 }
}
const epCode = (season: string, episode: string) => (season || episode ? `S${(season || '1').padStart(2, '0')}E${(episode || '1').padStart(2, '0')}` : '')

export function BeatTimeline() {
  const { files, docs, openFile, setTab, setDevTab, createFile, writeOther } = useStore()
  const scripts = files.filter((f) => f.kind === 'script')
  const cards = useMemo(() => breakdown(files, docs).filter((c) => c.kind === 'character'), [files, docs])

  const [scope, setScope] = useState<'episode' | 'series'>('episode')
  const [epPath, setEpPath] = useState<string | null>(scripts[0]?.path ?? null)
  const script = epPath && scripts.some((f) => f.path === epPath) ? epPath : (scripts[0]?.path ?? null)
  const [sel, setSel] = useState<Sel>(null)
  const [insp, setInsp] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [play, setPlay] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(4)
  const [entFilter, setEntFilter] = useState<Set<string>>(new Set())
  const [linking, setLinking] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [tpl, setTpl] = useState<string | null>(null) // plantilla elegida, pendiente de fusionar o reemplazar
  const [versions, setVersions] = useState<{ id: string; ts: number; label?: string; origin: string }[]>([])
  const wall = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Episodios en el eje: solo el activo, o toda la serie encadenada (orden por temporada/episodio).
  const eps = useMemo((): Ep[] => {
    const list = (scope === 'series' ? scripts : scripts.filter((f) => f.path === script)).map((f) => {
      const d = docs.find((x) => x.path === f.path)
      const fm = d ? readFrontmatter(d.content).data : {}
      return { f, d, season: String(fm['season'] ?? ''), episode: String(fm['episode'] ?? '') }
    }).sort((p, q) => (Number(p.season) || 0) - (Number(q.season) || 0) || (Number(p.episode) || 0) - (Number(q.episode) || 0) || p.f.name.localeCompare(q.f.name))
    let offset = 0
    return list.map(({ f, d, season, episode }) => {
      const doc = parseFountain(d?.content ?? '')
      const scenes = project(doc).scenes
      const mins = sceneMinutes(doc.tokens, scenes)
      const starts: number[] = []; let s = 0; for (const m of mins) { starts.push(s); s += m } starts.push(s)
      const outlinePath = `outline/${f.path.split('/').pop()!}`
      const od = docs.find((x) => x.path === outlinePath)
      const data = od ? readFrontmatter(od.content).data : {}
      const ep: Ep = {
        path: f.path, outlinePath, outlineContent: od?.content ?? null, name: f.name, season, episode, code: epCode(season, episode), content: d?.content ?? '',
        scenes, mins, starts, runtime: s, offset,
        acts: (Array.isArray(data['acts']) ? data['acts'] : []) as Act[], beats: (Array.isArray(data['beats']) ? data['beats'] : []) as Beat[], notes: (Array.isArray(data['notes']) ? data['notes'] : []) as Note[]
      }
      offset += Math.max(s, 0.5) // un episodio vacío ocupa medio minuto para que se vea su bloque
      return ep
    })
  }, [scripts, docs, scope, script])
  const active = eps.find((e) => e.path === script) ?? eps[0]
  const total = Math.max(0.5, eps.reduce((a, e) => a + Math.max(e.runtime, 0.5), 0))

  // La escaleta del episodio activo se crea una sola vez (guardia contra la doble creación mientras se recargan docs).
  const creating = useRef<string | null>(null)
  useEffect(() => {
    if (!active || active.outlineContent !== null || files.some((f) => f.path === active.outlinePath) || creating.current === active.outlinePath) return
    creating.current = active.outlinePath
    void createFile(active.outlinePath, TEMPLATE.outline(active.outlinePath), false).catch(() => undefined)
  }, [active, files, createFile])
  const loading = active?.outlineContent === null
  useEffect(() => { setSel(null); setPlay(0); if (script) void window.api.versionList(script).then(setVersions) }, [script, scope])
  const fit = useCallback((totalMin: number) => { const w = scrollRef.current?.clientWidth ?? 0; if (w && totalMin > 0) setZoom(Math.min(200, Math.max(0.2, (w - GUT - 24) / (16 * totalMin)))) }, [])
  useEffect(() => { fit(total) }, [script, scope, total, fit])
  // Reproducir: el cabezal avanza a ×velocidad (minutos de guion por minuto real).
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setPlay((p) => { const np = p + (speed * 0.1) / 60; if (np >= total) { setPlaying(false); return total } return np }), 100)
    return () => clearInterval(id)
  }, [playing, speed, total])

  const PXM = 16 * zoom
  const x = (m: number) => GUT + m * PXM
  const width = Math.max(600, GUT + total * PXM + 24)

  // Guardar en la escaleta del episodio (se crea si aún no existe).
  const save = (ep: Ep, patch: Record<string, unknown>) => {
    if (ep.outlineContent !== null) void writeOther(ep.outlinePath, writeFrontmatter(ep.outlineContent, patch))
    else if (!files.some((f) => f.path === ep.outlinePath)) void createFile(ep.outlinePath, writeFrontmatter(TEMPLATE.outline(ep.outlinePath), patch), false).catch(() => undefined)
  }

  // Elementos en el eje (con desplazamiento del episodio) y su empaquetado en subfilas.
  const flat = eps.flatMap((ep) => ep.scenes.map((s, i) => ({ ep, i, s, start: ep.offset + (ep.starts[i] ?? 0), dur: ep.mins[i] ?? 0 })))
  const actSpan = (ep: Ep, a: Act): [number, number] => { const a0 = x(ep.offset + (ep.starts[a.from] ?? 0)); const a1 = x(ep.offset + (ep.starts[Math.min(a.to + 1, ep.starts.length - 1)] ?? ep.runtime)); return [a0, Math.max(a1, a0 + 60)] }
  const actsP = pack(eps.flatMap((ep) => ep.acts.map((a, i) => { const [a0, a1] = actSpan(ep, a); return { a: a0, b: a1 - 2, it: { ep, i, a } } })))
  const beatsP = (() => {
    const all = eps.flatMap((ep) => ep.beats.map((b, i) => ({ ep, i, b, cx: Math.max(GUT + 6, x(ep.offset + (ep.starts[b.scene] ?? 0))) }))).sort((p, q) => p.cx - q.cx)
    return pack(all.map((it, k) => { const next = all.slice(k + 1).find((o) => o.cx > it.cx); const w = Math.max(44, Math.min(BEAT_W, next ? next.cx - it.cx - 4 : BEAT_W)); return { a: it.cx, b: it.cx + w, it: { ...it, w } } }))
  })()
  const seasons = useMemo(() => { const out: { season: string; a: number; b: number }[] = []; for (const ep of eps) { const last = out[out.length - 1]; const end = ep.offset + Math.max(ep.runtime, 0.5); if (last && last.season === ep.season) last.b = end; else out.push({ season: ep.season, a: ep.offset, b: end }) } return out }, [eps])
  const showSeasons = scope === 'series' && seasons.some((s) => s.season)

  // Aplicar plantilla (PRD §91): fusionar respeta lo que ya hay; reemplazar pide confirmación porque destruye actos y beats.
  const applyPreset = (name: string, mode: 'merge' | 'replace') => {
    const p = PRESETS[name]; if (!p || !active || !active.scenes.length) return
    if (mode === 'replace' && (active.acts.length || active.beats.length) && !window.confirm(`${t('Reemplazar la estructura de')} ${active.name}: ${active.acts.length} ${t('acto(s)')} ${t('y')} ${active.beats.length} beat(s) ${t('se perderán. ¿Continuar?')}`)) return
    const n = active.scenes.length
    const patch: Record<string, unknown> = {}
    const presetActs = p.acts ? (() => { let prevTo = -1; return p.acts.map(([title, , b], i) => { const from = Math.min(prevTo + 1, n - 1); const to = Math.max(from, Math.round(b * (n - 1)) - (i < p.acts!.length - 1 ? 1 : 0)); prevTo = to; return { title, summary: '', from, to, color: ACT_COLORS[i % ACT_COLORS.length] } }) })() : null
    const presetBeats = p.beats ? p.beats.map(([title, kind, f]) => ({ id: uid(), title, note: '', kind, scene: Math.round(f * (n - 1)) })) : null
    if (presetActs && (mode === 'replace' || !active.acts.length)) patch['acts'] = presetActs
    if (presetBeats) patch['beats'] = mode === 'replace' ? presetBeats : [...active.beats, ...presetBeats.filter((b) => !active.beats.some((x) => x.title === b.title))]
    save(active, patch)
    setTpl(null)
  }
  const addAct = () => { if (!active) return; const r = nextActRange(active.acts, Math.max(1, active.scenes.length)); save(active, { acts: [...r.acts, { title: `${t('Acto')} ${active.acts.length + 1}`, summary: '', from: r.from, to: r.to, color: ACT_COLORS[active.acts.length % ACT_COLORS.length] }] }); setSel({ kind: 'act', ep: active.path, key: active.acts.length }) }
  const addBeat = () => { if (!active) return; const at = flat.find((f) => f.ep === active && play >= f.start && play < f.start + f.dur)?.i ?? (sel?.kind === 'scene' && sel.ep === active.path ? Number(sel.key) : 0); const id = uid(); save(active, { beats: [...active.beats, { id, title: t('Nuevo beat'), note: '', scene: at, kind: 'setup' }] }); setSel({ kind: 'beat', ep: active.path, key: id }) }
  const addNote = () => { if (!active) return; const id = uid(); save(active, { notes: [...active.notes, { id, title: '', text: '', ...freeSpot(active.notes), color: NOTE_COLORS[active.notes.length % NOTE_COLORS.length]!, kind: 'idea', tags: [] }] }); setSel({ kind: 'note', ep: active.path, key: id }) }
  // Si el episodio está abierto en el Escritorio, parte del texto vivo (puede haber cambios aún sin autoguardar).
  const addScene = () => { if (!active) return; const st = useStore.getState(); const base = st.path === active.path ? st.text : active.content; const n = active.scenes.length + 1; void writeOther(active.path, base.replace(/\n+$/, '') + `\n\nINT. ${t('NUEVA ESCENA')} ${n} - DÍA\n\n`) }

  const exportMarkers = () => {
    const rows = [
      ...eps.flatMap((ep) => ep.acts.map((a) => ['ACT', tc(ep.offset + (ep.starts[a.from] ?? 0)), `${ep.code} ${a.title}`.trim()])),
      ...eps.flatMap((ep) => ep.beats.map((b) => ['BEAT', tc(ep.offset + (ep.starts[b.scene] ?? 0)), b.title])),
      ...flat.map((f) => ['SCENE', tc(f.start), `${f.ep.code} #${f.i + 1} ${f.s.heading}`.trim()])
    ].sort((p, q) => p[1]!.localeCompare(q[1]!))
    const csv = 'type,timecode,name\n' + rows.map((r) => r.map((c) => `"${c!.replace(/"/g, '""')}"`).join(',')).join('\n')
    void window.api.exportText(csv, `${scope === 'series' ? 'serie' : active?.name ?? 'timeline'}-markers.csv`)
  }
  const exportJson = () => {
    const data = eps.map((ep) => ({ episode: ep.name, code: ep.code, runtimeMinutes: ep.runtime, acts: ep.acts, beats: ep.beats, notes: ep.notes, scenes: ep.scenes.map((s, i) => ({ index: i + 1, heading: s.heading, start: ep.starts[i], minutes: ep.mins[i], characters: s.characters, words: s.wordCount })) }))
    void window.api.exportText(JSON.stringify({ app: 'writter', kind: 'beat-timeline', exportedAt: new Date().toISOString(), episodes: data }, null, 2), `${scope === 'series' ? 'serie' : active?.name ?? 'timeline'}-timeline.json`)
  }

  const drag = (id: string) => (e: React.PointerEvent) => {
    const el = wall.current
    if (!el || !active || (e.target as HTMLElement).closest('button') || linking) return
    const note = active.notes.find((n) => n.id === id)!
    const sx = e.clientX - note.x, sy = e.clientY - note.y
    let moved = false
    const move = (ev: PointerEvent) => { moved = true; const tg = el.querySelector<HTMLElement>(`[data-id="${id}"]`); if (tg) { tg.style.left = `${Math.max(0, ev.clientX - sx)}px`; tg.style.top = `${Math.max(0, ev.clientY - sy)}px` } }
    const up = (ev: PointerEvent) => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); if (moved) save(active, { notes: active.notes.map((n) => (n.id === id ? { ...n, x: Math.max(0, ev.clientX - sx), y: Math.max(0, ev.clientY - sy) } : n)) }) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  const clickNote = (id: string) => {
    if (!active) return
    if (!linking) { setSel({ kind: 'note', ep: active.path, key: id }); return }
    if (linking !== id) save(active, { notes: active.notes.map((n) => (n.id === linking ? { ...n, links: [...new Set([...(n.links ?? []), id])] } : n)) })
    setLinking(null)
  }

  const atPlay = flat.find((f) => play >= f.start && play < f.start + f.dur)
  const written = flat.filter((f) => f.s.wordCount > 15).length
  const links = eps.reduce((a, ep) => a + ep.notes.reduce((b, n) => b + (n.links?.length ?? 0), 0), 0)
  const inFilter = (s: Scene) => !entFilter.size || s.characters.some((c) => entFilter.has(c)) || s.links.some((c) => entFilter.has(c))
  const ticks = useMemo(() => { const step = zoom > 1.6 ? 1 : zoom > 0.8 ? 2 : 5; const out: number[] = []; for (let m = 0; m <= total; m += step) out.push(m); return out }, [total, zoom])
  const isSel = (kind: SelKind, ep: Ep, key: number | string) => sel?.kind === kind && sel.ep === ep.path && sel.key === key
  const noteById = new Map((active?.notes ?? []).map((n) => [n.id, n]))

  // Sin guiones no hay línea de tiempo: crear un episodio o vincular la carpeta de la historia.
  if (!scripts.length || !active) return <main className="page bt"><NoScripts /></main>

  return (
    <main className="page bt">
      <div className="toolbar wrap">
        {scripts.length > 1 && (
          <div className="segmented" title={t('Alcance')}>
            <button className={scope === 'episode' ? 'on' : ''} onClick={() => setScope('episode')}>{t('Episodio')}</button>
            <button className={scope === 'series' ? 'on' : ''} onClick={() => setScope('series')}>{t('Serie')}</button>
          </div>
        )}
        <select value={script ?? ''} onChange={(e) => setEpPath(e.target.value)} title={t('Episodio')}>
          {scripts.map((f) => { const m = eps.find((e) => e.path === f.path); return <option key={f.path} value={f.path}>{m?.code ? `${m.code} · ` : ''}{f.name}</option> })}
        </select>
        <select value="" disabled={loading} onChange={(e) => { if (e.target.value) setTpl(e.target.value) }} title={t('Aplicar plantilla')}>
          <option value="">{t('Aplicar plantilla…')}</option>
          {Object.keys(PRESETS).map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <button className="mini ghost" onClick={addScene} title={t('Añade un encabezado nuevo al final del episodio activo')}><Icon name="plus" size={12} />{t('Escena')}</button>
        <button className="mini ghost" disabled={loading} onClick={addBeat}><Icon name="plus" size={12} />Beat</button>
        <button className="mini ghost" disabled={loading} onClick={addAct}><Icon name="plus" size={12} />{t('Acto')}</button>
        <button className="mini ghost" disabled={loading} onClick={addNote}><Icon name="plus" size={12} />{t('Nota')}</button>
        <span className="sep" />
        <button className="mini ghost" title={t('Alejar')} onClick={() => setZoom((z) => Math.max(0.2, z / 1.25))}><Icon name="minus" size={12} /></button>
        <button className="mini ghost" title={t('Acercar')} onClick={() => setZoom((z) => Math.min(200, z * 1.25))}><Icon name="plus" size={12} /></button>
        <button className="mini ghost" onClick={() => fit(total)}>{t('Ajustar')}</button>
        <button className={playing ? 'mini on' : 'mini ghost'} title={playing ? t('Pausar') : t('Reproducir')} onClick={() => setPlaying((p) => !p)}><Icon name={playing ? 'pause' : 'play'} size={12} /></button>
        <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} title={t('Velocidad')}>{[1, 4, 16, 64].map((v) => <option key={v} value={v}>×{v}</option>)}</select>
        <span className="grow" />
        <span className="muted tiny">{flat.length} {t('escenas')} · {eps.reduce((a, e) => a + e.beats.length, 0)} beats · {tc(total)} · {t('escritas')} {written}/{flat.length} · {links} {t('conex.')}</span>
        <div className="cardmenu">
          <button className="mini ghost" onClick={() => setExportOpen((o) => !o)}>{t('Exportar')}</button>
          {exportOpen && (
            <div className="menu" role="menu" onMouseLeave={() => setExportOpen(false)}>
              <button className="menu-item" onClick={() => { setExportOpen(false); exportMarkers() }}>{t('Marcadores (CSV)')}</button>
              <button className="menu-item" onClick={() => { setExportOpen(false); exportJson() }}>{t('Línea de tiempo (JSON)')}</button>
            </div>
          )}
        </div>
        <button className={insp ? 'mini on' : 'mini ghost'} title={t('Inspector')} onClick={() => setInsp((v) => !v)}><Icon name="panel" size={12} />{t('Inspector')}</button>
      </div>

      <div className="toolbar wrap tiny">
        <span className="muted">{t('Filtros')}:</span>
        {cards.slice(0, 12).map((c) => (
          <button key={c.path} className={entFilter.has(c.name) ? 'on mini' : 'mini ghost'} title={c.name} onClick={() => setEntFilter((s) => { const n = new Set(s); n.has(c.name) ? n.delete(c.name) : n.add(c.name); return n })}><span className="ell">{c.name}</span> {c.appearances.length}</button>
        ))}
      </div>

      <div className={`bt-body ${insp ? 'with-insp' : ''}`}>
        <div className="bt-scroll scroll" ref={scrollRef}>
          <div className="bt-lanes" style={{ width }}>
            {/* Regla de tiempo: timecode del cabezal, marcas de episodio y playhead */}
            <div className="bt-ruler" style={{ width }} onPointerDown={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); const set = (cx: number) => setPlay(Math.max(0, Math.min(total, (cx - r.left - GUT) / PXM))); set(e.clientX); const mv = (ev: PointerEvent) => set(ev.clientX); const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up) }; window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up) }}>
              <span className="bt-tc">{atPlay ? `${atPlay.ep.code || atPlay.ep.name} · ` : ''}{tc(play)}{atPlay ? ` · #${atPlay.i + 1}` : ''}</span>
              {ticks.map((m) => <span key={m} className="tick" style={{ left: x(m) }}>{tc(m)}</span>)}
            </div>
            <div className="playhead" style={{ left: x(play) }} />

            {showSeasons && (
              <div className="bt-lane" style={{ height: 34 }}><span className="lanelabel">{t('Temporadas')}</span>
                {seasons.map((s, i) => <div key={i} className="bt-card season" style={{ left: x(s.a), width: Math.max(40, x(s.b) - x(s.a) - 2) }}><b>{s.season ? `${t('Temporada')} ${s.season}` : t('Sin temporada')}</b></div>)}
              </div>
            )}

            <div className="bt-lane" style={{ height: 44 }}><span className="lanelabel">{t('Episodios')}</span>
              {eps.map((ep) => (
                <div key={ep.path} className={`bt-card episode ${ep === active ? 'on' : ''}`} style={{ left: x(ep.offset), width: Math.max(60, x(ep.offset + Math.max(ep.runtime, 0.5)) - x(ep.offset) - 2) }} onClick={() => setEpPath(ep.path)} title={ep.name}>
                  <b>{ep.code ? `${ep.code} · ` : ''}{ep.name}</b><span>{ep.scenes.length} {t('esc.')} · {tc(ep.runtime)}</span>
                </div>
              ))}
            </div>

            <div className="bt-lane" style={{ height: 14 + (actsP[0]?.rows ?? 1) * 58 }}><span className="lanelabel">{t('Actos')}</span>
              {actsP.map(({ it: { ep, i, a }, row }) => {
                const [a0, a1] = actSpan(ep, a)
                return (
                  <div key={ep.path + i} className={`bt-card act ${isSel('act', ep, i) ? 'on' : ''}`} style={{ left: a0, width: a1 - a0 - 2, top: 8 + row * 58, background: a.color ?? ACT_COLORS[i % ACT_COLORS.length] }} onClick={() => setSel({ kind: 'act', ep: ep.path, key: i })} title={`${a.title} · #${a.from + 1}–#${a.to + 1}`}>
                    <b>{a.title}</b><span>{a.summary || `#${a.from + 1}–#${a.to + 1}`}</span>
                  </div>
                )
              })}
            </div>

            <div className="bt-lane" style={{ height: 14 + (beatsP[0]?.rows ?? 1) * 50 }}><span className="lanelabel">Beats</span>
              {beatsP.map(({ it: { ep, i, b, cx, w }, row }) => (
                <div key={b.id} className={`bt-card beat ${isSel('beat', ep, b.id) ? 'on' : ''}`} style={{ left: cx, width: w, top: 8 + row * 50, background: KINDS[b.kind] ?? KINDS['other'] }} onClick={() => setSel({ kind: 'beat', ep: ep.path, key: b.id })} title={`${t(KIND_LABEL[b.kind] ?? b.kind)} · #${b.scene + 1}`}>
                  <span className="badge">B{i + 1}</span><b>{b.title}</b>
                </div>
              ))}
            </div>

            <div className="bt-lane" style={{ height: 40 }}><span className="lanelabel">{t('Escenas')}</span>
              {flat.map((f) => {
                const h = f.s.heading.toUpperCase()
                const cls = /^(INT|I\/E)/.test(h) ? 'int' : /^EXT/.test(h) ? 'ext' : ''
                return (
                  <div key={f.ep.path + f.i} className={`bt-scene ${cls} ${isSel('scene', f.ep, f.i) ? 'on' : ''} ${inFilter(f.s) ? '' : 'dim'} ${f.s.wordCount > 15 ? '' : 'unwritten'}`} style={{ left: x(f.start), width: Math.max(28, x(f.dur) - GUT - 2) }} onClick={() => { setEpPath(f.ep.path); setSel({ kind: 'scene', ep: f.ep.path, key: f.i }) }} title={`${f.s.heading} · ${f.dur.toFixed(1)}m`}>
                    <b>#{f.i + 1}</b> <span className="ell">{f.s.heading.replace(/^(INT|EXT)[.\s]+/i, '').slice(0, 18)}</span>
                    <span className="dur">{f.dur.toFixed(1)}m</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Muro creativo del episodio activo: notas con título y etiquetas, conexiones y nodos de entidad */}
          <div className="bt-wall" ref={wall} onClick={(e) => { if (e.target === e.currentTarget) setSel(null) }}>
            <svg className="bt-links">
              {active.notes.flatMap((n) => (n.links ?? []).map((tid) => { const b = noteById.get(tid); return b ? <line key={n.id + tid} x1={n.x + 97} y1={n.y + 40} x2={b.x + 97} y2={b.y + 40} stroke="var(--accent)" strokeDasharray="4 3" /> : null }))}
            </svg>
            {active.notes.map((nt) => (
              <div key={nt.id} data-id={nt.id} className={`note ${linking === nt.id ? 'linking' : ''} ${isSel('note', active, nt.id) ? 'on' : ''}`} style={{ left: nt.x, top: nt.y, background: nt.color }} onPointerDown={drag(nt.id)} onClick={() => clickNote(nt.id)}>
                <div className="row">
                  <b className="ell grow">{nt.title || t('Nota')}</b>
                  <button className="mini ghost" title={t('Conectar')} onClick={(e) => { e.stopPropagation(); setLinking(linking === nt.id ? null : nt.id) }}><Icon name="link" size={12} /></button>
                  <button className="mini ghost" title={t('Quitar')} onClick={(e) => { e.stopPropagation(); save(active, { notes: active.notes.filter((x) => x.id !== nt.id) }); if (isSel('note', active, nt.id)) setSel(null) }}><Icon name="close" size={12} /></button>
                </div>
                <p>{nt.text || <span className="muted">{t('Idea…')}</span>}</p>
                {(nt.tags?.length ?? 0) > 0 && <div className="chips">{nt.tags!.map((g) => <span key={g} className="chip">{t(g)}</span>)}</div>}
              </div>
            ))}
            <div className="bt-entities">
              {cards.slice(0, 8).map((c) => (
                <div key={c.path} className="bt-entity">
                  <strong className="ell">{c.name}</strong>
                  <span className="muted tiny">{t('presente en')} {c.appearances.length} {t('escenas')}</span>
                  <div className="row"><button className="mini ghost" onClick={() => { void openFile(c.path); setTab('dev'); setDevTab('characters') }}>{t('Ficha')}</button><button className={entFilter.has(c.name) ? 'mini on' : 'mini ghost'} onClick={() => setEntFilter((s) => { const n = new Set(s); n.has(c.name) ? n.delete(c.name) : n.add(c.name); return n })}>{t('Ver escenas')}</button></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {insp && <Inspector sel={sel} eps={eps} active={active} save={save} setSel={setSel} versions={versions} openScene={(ep, i) => { void openFile(ep.path, ep.scenes[i]?.startLine); setTab('desk') }} />}
      </div>

      <div className="bt-legend">
        {Object.entries(KINDS).map(([k, c]) => <span key={k}><span className="dot" style={{ background: c }} /> {t(KIND_LABEL[k] ?? k)}</span>)}
        <span className="muted">· {t('borde punteado = escena sin escribir')}</span>
      </div>

      {/* Aplicar plantilla (PRD §91): fusionar o reemplazar, nunca sobrescribir en silencio. */}
      {tpl && (
        <div className="modal-backdrop" onClick={() => setTpl(null)}>
          <div className="modal" style={{ width: 'min(460px, 92vw)' }} onClick={(e) => e.stopPropagation()}>
            <div className="row"><h1>{t('Aplicar plantilla')}: {tpl}</h1><span className="grow" /><button className="mini ghost" onClick={() => setTpl(null)}>{t('Cerrar')}</button></div>
            <p className="muted tiny">{t('Se coloca sobre')} {active.name} · {active.scenes.length} {t('escenas')} · {active.acts.length} {t('acto(s)')} · {active.beats.length} beat(s).</p>
            <div className="row">
              <button onClick={() => applyPreset(tpl, 'merge')}>{t('Fusionar')}</button>
              <button className="ghost danger" onClick={() => applyPreset(tpl, 'replace')}>{t('Reemplazar')}</button>
            </div>
            <p className="muted tiny">{t('Fusionar conserva tus actos y añade solo los beats que falten. Reemplazar descarta la estructura actual.')}</p>
          </div>
        </div>
      )}
    </main>
  )
}

// Inspector: edita la tarjeta seleccionada (acto, beat, nota o escena). El timeline solo muestra.
function Inspector({ sel, eps, active, save, setSel, versions, openScene }: { sel: Sel; eps: Ep[]; active: Ep; save: (ep: Ep, patch: Record<string, unknown>) => void; setSel: (s: Sel) => void; versions: { id: string; ts: number; label?: string; origin: string }[]; openScene: (ep: Ep, i: number) => void }) {
  const ep = sel ? eps.find((e) => e.path === sel.ep) : undefined
  const head = (title: string) => <div className="row"><strong className="ell grow">{title}</strong><button className="mini ghost" title={t('Cerrar')} onClick={() => setSel(null)}><Icon name="close" size={12} /></button></div>
  const sceneOpts = (e: Ep) => e.scenes.map((s, i) => <option key={i} value={i}>#{i + 1} {s.heading.slice(0, 28)}</option>)
  if (!sel || !ep) return (
    <aside className="bt-insp"><h2>{t('Inspector')}</h2><p className="muted tiny">{t('Selecciona un acto, un beat, una nota o una escena para editarla aquí. Las tarjetas del timeline solo muestran.')}</p>
      <p className="muted tiny">{active.code ? `${active.code} · ` : ''}{active.name}: {active.scenes.length} {t('escenas')} · {active.acts.length} {t('actos')} · {active.beats.length} beats · {active.notes.length} {t('notas')}</p></aside>
  )
  if (sel.kind === 'act') {
    const i = Number(sel.key); const a = ep.acts[i]; if (!a) return null
    const upd = (p: Partial<Act>) => save(ep, { acts: ep.acts.map((y, j) => (j === i ? { ...y, ...p } : y)) })
    return (
      <aside className="bt-insp">{head(`${t('Acto')} ${i + 1}`)}
        <label className="field"><span>{t('Título')}</span><BlurInput value={a.title} onCommit={(v) => upd({ title: v })} /></label>
        <label className="field"><span>{t('Resumen')}</span><BlurInput textarea rows={4} value={a.summary} placeholder={t('Resumen del acto')} onCommit={(v) => upd({ summary: v })} /></label>
        <div className="row"><label className="field grow"><span>{t('Desde')}</span><select value={a.from} onChange={(e) => upd({ from: Number(e.target.value), to: Math.max(Number(e.target.value), a.to) })}>{sceneOpts(ep)}</select></label>
          <label className="field grow"><span>{t('Hasta')}</span><select value={a.to} onChange={(e) => upd({ to: Number(e.target.value), from: Math.min(Number(e.target.value), a.from) })}>{sceneOpts(ep)}</select></label></div>
        <div className="field"><span>{t('Color')}</span><div className="swatches">{ACT_COLORS.map((c) => <button key={c} className={`swatch ${(a.color ?? ACT_COLORS[i % ACT_COLORS.length]) === c ? 'on' : ''}`} style={{ background: c }} onClick={() => upd({ color: c })} />)}</div></div>
        <button className="ghost danger" onClick={() => { save(ep, { acts: ep.acts.filter((_, j) => j !== i) }); setSel(null) }}><Icon name="trash" size={12} />{t('Eliminar acto')}</button>
      </aside>
    )
  }
  if (sel.kind === 'beat') {
    const b = ep.beats.find((y) => y.id === sel.key); if (!b) return null
    const upd = (p: Partial<Beat>) => save(ep, { beats: ep.beats.map((y) => (y.id === b.id ? { ...y, ...p } : y)) })
    return (
      <aside className="bt-insp">{head(`Beat · ${t(KIND_LABEL[b.kind] ?? b.kind)}`)}
        <label className="field"><span>{t('Título')}</span><BlurInput value={b.title} onCommit={(v) => upd({ title: v })} /></label>
        <div className="row"><label className="field grow"><span>{t('Tipo')}</span><select value={b.kind} onChange={(e) => upd({ kind: e.target.value })}>{Object.keys(KINDS).map((k) => <option key={k} value={k}>{t(KIND_LABEL[k] ?? k)}</option>)}</select></label>
          <label className="field grow"><span>{t('Escena')}</span><select value={b.scene} onChange={(e) => upd({ scene: Number(e.target.value) })}>{sceneOpts(ep)}</select></label></div>
        <label className="field"><span>{t('Nota')}</span><BlurInput textarea rows={5} value={b.note} placeholder={t('Qué pasa y por qué importa')} onCommit={(v) => upd({ note: v })} /></label>
        <button className="ghost danger" onClick={() => { save(ep, { beats: ep.beats.filter((y) => y.id !== b.id) }); setSel(null) }}><Icon name="trash" size={12} />{t('Eliminar beat')}</button>
      </aside>
    )
  }
  if (sel.kind === 'note') {
    const n = ep.notes.find((y) => y.id === sel.key); if (!n) return null
    const upd = (p: Partial<Note>) => save(ep, { notes: ep.notes.map((y) => (y.id === n.id ? { ...y, ...p } : y)) })
    return (
      <aside className="bt-insp">{head(t('Nota'))}
        <label className="field"><span>{t('Título')}</span><BlurInput value={n.title ?? ''} onCommit={(v) => upd({ title: v })} /></label>
        <label className="field"><span>{t('Texto')}</span><BlurInput textarea rows={6} value={n.text} placeholder={t('Idea…')} onCommit={(v) => upd({ text: v })} /></label>
        <div className="field"><span>{t('Etiquetas')}</span><div className="chips">{TAGS.map((g) => <button key={g} className={n.tags?.includes(g) ? 'mini on' : 'mini ghost'} onClick={() => upd({ tags: n.tags?.includes(g) ? n.tags.filter((z) => z !== g) : [...(n.tags ?? []), g] })}>{t(g)}</button>)}</div></div>
        <div className="field"><span>{t('Color')}</span><div className="swatches">{NOTE_COLORS.map((c) => <button key={c} className={`swatch ${n.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => upd({ color: c })} />)}</div></div>
        {(n.links?.length ?? 0) > 0 && <p className="muted tiny">{n.links!.length} {t('conex.')}</p>}
        <button className="ghost danger" onClick={() => { save(ep, { notes: ep.notes.filter((y) => y.id !== n.id) }); setSel(null) }}><Icon name="trash" size={12} />{t('Eliminar nota')}</button>
      </aside>
    )
  }
  const i = Number(sel.key); const s = ep.scenes[i]; if (!s) return null
  const lines = ep.content.split('\n').slice(s.startLine, s.endLine)
  const written = ep.scenes.filter((z) => z.wordCount > 15).length
  return (
    <aside className="bt-insp">{head(`#${i + 1} ${s.heading}`)}
      {versions.length > 0 && ep === active && <select><option>{t('Versión actual')}</option>{versions.map((v) => <option key={v.id}>{new Date(v.ts).toLocaleDateString()} · {v.label ?? v.origin}</option>)}</select>}
      <div className="bt-prog"><div style={{ width: `${Math.round((written / Math.max(1, ep.scenes.length)) * 100)}%` }} /></div>
      <div className="muted tiny">{s.characters.join(', ') || s.links.join(', ')} · {s.wordCount} {t('palabras')} · {(ep.mins[i] ?? 0).toFixed(1)} min</div>
      <pre className="scenetext">{lines.join('\n')}</pre>
      <button onClick={() => openScene(ep, i)}>{t('Abrir en Escritorio')}</button>
    </aside>
  )
}
