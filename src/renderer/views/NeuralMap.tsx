import { useEffect, useMemo, useRef, useState } from 'react'
import { articulationPoints, buildStoryGraph, components, type EdgeType, type GEdge, type GNode, type NKind } from '../../core/graph'
import { t } from '../i18n'
import { useStore } from '../store'

// Mapa neural (F): grafo de la historia con aristas tipadas, filtros, islas y puentes críticos. SVG propio.
type P = GNode & { x: number; y: number; deg: number }
const COLOR: Record<string, string> = { character: '#e8437f', location: '#3ddc97', prop: '#c47d1a', scene: '#b388ff', script: '#4f8cff', knowledge: '#8b91a0', outline: '#8b91a0', other: '#555' }
const ECOLOR: Record<EdgeType, string> = { appears: '#ffffff20', mentions: '#4f8cff', scene: '#b388ff', traffic: '#3ddc97', family: '#59c1d6', group: '#c47d1a' }
const EDGE_LABEL: [EdgeType, string][] = [
  ['appears', 'Apariciones'], ['scene', 'Escena↔escena'], ['traffic', 'Tráfico entre lugares'], ['family', 'Familias de lugar'], ['mentions', 'Menciones'], ['group', 'Grupos']
]
const LAYERS: [NKind, string][] = [['character', 'Personajes'], ['location', 'Locaciones'], ['prop', 'Ítems'], ['scene', 'Escenas']]

type Opts = { sep: number; gravity: string; centers: Map<number, { x: number; y: number }> | null; comp: Map<string, number> }
function force(nodes: P[], edges: GEdge[], W: number, H: number, iters: number, o: Opts) {
  const idx = new Map(nodes.map((n) => [n.id, n]))
  const v = new Map(nodes.map((n) => [n.id, { x: 0, y: 0 }]))
  const rest = 70 * o.sep
  for (let it = 0; it < iters; it++) {
    for (const a of nodes) for (const b of nodes) {
      if (a === b) continue
      const dx = a.x - b.x, dy = a.y - b.y
      const d2 = Math.max(dx * dx + dy * dy, 4)
      const f = (2500 * o.sep) / d2
      const va = v.get(a.id)!
      va.x += (dx / Math.sqrt(d2)) * f
      va.y += (dy / Math.sqrt(d2)) * f
    }
    for (const e of edges) {
      const a = idx.get(e.s), b = idx.get(e.t)
      if (!a || !b) continue
      const dx = b.x - a.x, dy = b.y - a.y
      const d = Math.sqrt(dx * dx + dy * dy) || 1
      const f = (d - rest) * 0.03
      const va = v.get(a.id)!, vb = v.get(b.id)!
      va.x += (dx / d) * f; va.y += (dy / d) * f
      vb.x -= (dx / d) * f; vb.y -= (dy / d) * f
    }
    for (const n of nodes) {
      const vn = v.get(n.id)!
      const c = o.centers ? o.centers.get(o.comp.get(n.id) ?? -1) ?? { x: W / 2, y: H / 2 } : { x: W / 2, y: H / 2 }
      const g = o.gravity !== 'all' && n.kind === o.gravity ? 0.02 : 0.003
      vn.x += (c.x - n.x) * g; vn.y += (c.y - n.y) * g
      n.x += vn.x * 0.4; n.y += vn.y * 0.4
      vn.x *= 0.55; vn.y *= 0.55
    }
  }
}

export function NeuralMap() {
  const { files, docs, openFile, setTab } = useStore()
  const [layers, setLayers] = useState<Set<NKind>>(new Set<NKind>(['character', 'location', 'prop', 'scene']))
  const [etypes, setEtypes] = useState<Set<EdgeType>>(new Set(['appears', 'scene', 'traffic', 'family', 'mentions', 'group']))
  const [showWeak, setShowWeak] = useState(true)
  const [showUnconnected, setShowUnconnected] = useState(false)
  const [showCatalog, setShowCatalog] = useState(false)
  const [bridges, setBridges] = useState(false)
  const [islands, setIslands] = useState(false)
  const [sep, setSep] = useState(1)
  const [gravity, setGravity] = useState('all')
  const [season, setSeason] = useState('')
  const [episode, setEpisode] = useState('')
  const [q, setQ] = useState('')
  const [view, setView] = useState({ x: 0, y: 0, k: 1 })
  const [spin, setSpin] = useState(false)
  const [rot, setRot] = useState(0)
  const [nodes, setNodes] = useState<P[]>([])
  const svg = useRef<SVGSVGElement>(null)
  const W = 1200, H = 800

  const built = useMemo(() => buildStoryGraph(files, docs), [files, docs])
  const art = useMemo(() => articulationPoints(built.nodes, built.edges), [built])
  const seasons = useMemo(() => [...new Set(built.nodes.filter((n) => n.kind === 'scene' && n.season).map((n) => n.season))].sort(), [built])
  const episodes = useMemo(() => [...new Set(built.nodes.filter((n) => n.kind === 'scene' && n.episode && (!season || n.season === season)).map((n) => n.episode))].sort((a, b) => Number(a) - Number(b)), [built, season])

  // Grafo visible según filtros. Recalcula posiciones cuando cambia el conjunto o el layout.
  const visible = useMemo(() => {
    const nodeOk = (n: GNode) => {
      if (!layers.has(n.kind)) return false
      if (n.kind === 'scene') return (!season || n.season === season) && (!episode || n.episode === episode)
      return showCatalog || n.appear > 0
    }
    const kept = new Set(built.nodes.filter(nodeOk).map((n) => n.id))
    const edges = built.edges.filter((e) => etypes.has(e.type) && (showWeak || e.type === 'appears' || e.w > 1) && kept.has(e.s) && kept.has(e.t))
    const deg = new Map<string, number>()
    for (const e of edges) { deg.set(e.s, (deg.get(e.s) ?? 0) + 1); deg.set(e.t, (deg.get(e.t) ?? 0) + 1) }
    let ns = built.nodes.filter((n) => kept.has(n.id))
    if (!showUnconnected) ns = ns.filter((n) => (deg.get(n.id) ?? 0) > 0)
    const finalIds = new Set(ns.map((n) => n.id))
    const es = edges.filter((e) => finalIds.has(e.s) && finalIds.has(e.t))
    return { ns, es, deg, comp: components(ns, es) }
  }, [built, layers, etypes, showWeak, showUnconnected, showCatalog, season, episode])

  // Layout: coloca nodos (islas -> un centro por componente en anillo; nube -> centro único).
  useEffect(() => {
    const comps = [...new Set(visible.comp.values())]
    const centers = islands ? new Map(comps.map((c, i) => {
      const a = (i / Math.max(1, comps.length)) * Math.PI * 2
      return [c, { x: W / 2 + Math.cos(a) * 280, y: H / 2 + Math.sin(a) * 200 }] as const
    })) : null
    const ns: P[] = visible.ns.map((n, i) => {
      const a = (i / Math.max(1, visible.ns.length)) * Math.PI * 2
      const c = centers?.get(visible.comp.get(n.id) ?? -1) ?? { x: W / 2, y: H / 2 }
      return { ...n, x: c.x + Math.cos(a) * 120, y: c.y + Math.sin(a) * 100, deg: visible.deg.get(n.id) ?? 0 }
    })
    force(ns, visible.es, W, H, 250, { sep, gravity, centers, comp: visible.comp })
    setNodes(ns)
  }, [visible, islands, sep, gravity])

  // Auto-spin: rota la vista lentamente.
  useEffect(() => {
    if (!spin) return
    let raf = 0
    const tick = () => { setRot((r) => (r + 0.15) % 360); raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [spin])

  const byId = new Map(nodes.map((n) => [n.id, n]))
  const ql = q.toLowerCase()
  const hit = (n: P) => ql && n.label.toLowerCase().includes(ql)
  const hulls = useMemo(() => {
    if (!islands) return []
    const by = new Map<number, P[]>()
    for (const n of nodes) { const c = visible.comp.get(n.id) ?? -1; by.set(c, [...(by.get(c) ?? []), n]) }
    return [...by.values()].filter((g) => g.length > 1).map((g) => {
      const cx = g.reduce((a, n) => a + n.x, 0) / g.length, cy = g.reduce((a, n) => a + n.y, 0) / g.length
      const r = Math.max(...g.map((n) => Math.hypot(n.x - cx, n.y - cy))) + 34
      return { cx, cy, r }
    })
  }, [islands, nodes, visible.comp])

  const dragNode = (id: string) => (e: React.PointerEvent) => {
    e.stopPropagation()
    const move = (ev: PointerEvent) => setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, x: n.x + ev.movementX / view.k, y: n.y + ev.movementY / view.k } : n)))
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  const pan = () => {
    const move = (ev: PointerEvent) => setView((v) => ({ ...v, x: v.x + ev.movementX, y: v.y + ev.movementY }))
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  const wheel = (e: React.WheelEvent) => setView((v) => ({ ...v, k: Math.max(0.3, Math.min(3, v.k * (e.deltaY < 0 ? 1.1 : 0.9))) }))
  const toggle = <T,>(set: React.Dispatch<React.SetStateAction<Set<T>>>, x: T) => set((s) => { const n = new Set(s); n.has(x) ? n.delete(x) : n.add(x); return n })
  const relayout = () => { setView({ x: 0, y: 0, k: 1 }); setNodes((ns) => [...ns]) }

  const chk = (on: boolean, label: string, fn: () => void, count?: number, color?: string) => (
    <button className={on ? 'on mini' : 'mini ghost'} style={color ? { borderColor: color } : undefined} onClick={fn}>{color ? '● ' : (on ? '☑ ' : '☐ ')}{label}{count !== undefined ? ` (${count})` : ''}</button>
  )
  const edgeCount = (ty: EdgeType) => built.edges.filter((e) => e.type === ty).length
  const orphans = built.nodes.filter((n) => n.kind !== 'scene' && n.appear === 0).length

  return (
    <main className="page nmap">
      <div className="toolbar wrap">
        {LAYERS.map(([k, l]) => chk(layers.has(k), t(l), () => toggle(setLayers, k), undefined, COLOR[k]))}
        <span className="sep" />
        <span className="muted tiny">{visible.ns.length} {t('nodos')} · {visible.es.length} {t('enlaces')}</span>
        <span className="grow" />
        <input placeholder={t('Buscar nodo…')} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="nmap-body">
        <aside className="nmap-controls scroll">
          <h3>{t('Qué enlaces se muestran')}</h3>
          {EDGE_LABEL.map(([ty, l]) => chk(etypes.has(ty), t(l), () => toggle(setEtypes, ty), edgeCount(ty), ECOLOR[ty]))}
          {chk(showWeak, t('Enlaces débiles'), () => setShowWeak((v) => !v))}
          {chk(showUnconnected, t('Mostrar sueltos'), () => setShowUnconnected((v) => !v))}
          {chk(showCatalog, t('Catálogo sin aparición'), () => setShowCatalog((v) => !v), orphans)}
          {chk(bridges, t('Puentes críticos'), () => setBridges((v) => !v), art.size)}
          {chk(islands, t('Islas'), () => setIslands((v) => !v))}

          <h3>{t('Disposición')}</h3>
          <label className="field"><span>{t('Modo')}</span>
            <select value={islands ? 'islands' : 'cloud'} onChange={(e) => setIslands(e.target.value === 'islands')}>
              <option value="cloud">{t('Nube libre')}</option>
              <option value="islands">{t('Islas (por componente)')}</option>
            </select>
          </label>
          <label className="field"><span>{t('Separación')}</span>
            <input type="range" min={0.5} max={2} step={0.1} value={sep} onChange={(e) => setSep(Number(e.target.value))} />
          </label>
          <label className="field"><span>{t('Gravedad prioritaria')}</span>
            <select value={gravity} onChange={(e) => setGravity(e.target.value)}>
              <option value="all">{t('Todo por igual')}</option>
              <option value="character">{t('Personajes')}</option>
              <option value="location">{t('Locaciones')}</option>
              <option value="scene">{t('Escenas')}</option>
            </select>
          </label>
          <label className="field"><span>{t('Temporada')}</span>
            <select value={season} onChange={(e) => { setSeason(e.target.value); setEpisode('') }}>
              <option value="">{t('Todas')}</option>
              {seasons.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="field"><span>{t('Episodio')}</span>
            <select value={episode} onChange={(e) => setEpisode(e.target.value)}>
              <option value="">{t('Todos')}</option>
              {episodes.map((ep) => <option key={ep} value={ep}>{ep}</option>)}
            </select>
          </label>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="mini ghost" onClick={relayout}>{t('Reordenar')}</button>
            <button className={spin ? 'mini on' : 'mini ghost'} onClick={() => setSpin((v) => !v)}>{t('Auto-giro')}</button>
          </div>
        </aside>

        <svg ref={svg} className="map" viewBox={`0 0 ${W} ${H}`} onPointerDown={pan} onWheel={wheel}>
          <g transform={`translate(${view.x},${view.y}) scale(${view.k}) rotate(${rot} ${W / 2} ${H / 2})`}>
            {hulls.map((h, i) => <circle key={i} cx={h.cx} cy={h.cy} r={h.r} fill="#ffffff05" stroke="#ffffff22" strokeDasharray="4 4" />)}
            {visible.es.map((e, i) => {
              const a = byId.get(e.s), b = byId.get(e.t)
              if (!a || !b) return null
              const strong = hit(a) || hit(b)
              return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={strong ? '#ffffffaa' : ECOLOR[e.type]} strokeWidth={Math.min(3, 0.6 + e.w * 0.4)} strokeDasharray={e.type === 'mentions' ? '3 3' : undefined} />
            })}
            {nodes.map((n) => {
              const r = 4 + Math.min(14, Math.sqrt(n.deg) * 2.2)
              const dim = ql && !hit(n)
              const isArt = bridges && art.has(n.id)
              const col = COLOR[n.kind] ?? '#888'
              return (
                <g key={n.id} transform={`translate(${n.x},${n.y})`} opacity={dim ? 0.2 : 1} onPointerDown={dragNode(n.id)} onDoubleClick={() => { if (n.kind !== 'scene') { void openFile(n.id); setTab('desk') } else if (n.scriptPath) { void openFile(n.scriptPath); setTab('desk') } }} style={{ cursor: 'grab' }}>
                  {n.kind === 'scene'
                    ? <polygon points={`0,${-r} ${r},0 0,${r} ${-r},0`} fill={col} stroke={isArt ? '#fff' : (hit(n) ? '#fff' : 'none')} strokeWidth={isArt ? 3 : 2} />
                    : <circle r={r} fill={col} stroke={isArt ? '#fff' : (hit(n) ? '#fff' : 'none')} strokeWidth={isArt ? 3 : 2} />}
                  {isArt && <circle r={r + 4} fill="none" stroke="#ff5a1f" strokeWidth={1.5} />}
                  <text x={r + 4} y={4} fontSize={n.kind === 'scene' ? 9 : 11} fill={n.kind === 'scene' ? 'var(--dim)' : 'var(--fg)'} transform={`rotate(${-rot})`}>{n.label.length > 28 ? n.label.slice(0, 27) + '…' : n.label}<title>{n.label}</title></text>
                </g>
              )
            })}
          </g>
        </svg>
      </div>
    </main>
  )
}
