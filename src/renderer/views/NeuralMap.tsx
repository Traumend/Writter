import { useEffect, useMemo, useRef, useState } from 'react'
import { breakdown } from '../../core/breakdown'
import type { FileKind } from '../../core/types/ipc'
import { useStore } from '../store'

// Mapa neural (F): grafo completo con capas, escenas como nodos, búsqueda, pan/zoom y arrastre. SVG propio.
type Node = { id: string; kind: FileKind | 'scene'; label: string; x: number; y: number; deg: number }
type Edge = { s: string; t: string }
const COLOR: Record<string, string> = { script: '#4f8cff', character: '#e8437f', location: '#3ddc97', prop: '#c47d1a', scene: '#b388ff', outline: '#8b91a0', knowledge: '#8b91a0', other: '#555' }
const LAYERS: [FileKind | 'scene', string][] = [['character', 'Personajes'], ['location', 'Locaciones'], ['prop', 'Ítems'], ['scene', 'Escenas']]

function force(nodes: Node[], edges: Edge[], W: number, H: number, iters: number) {
  const idx = new Map(nodes.map((n) => [n.id, n]))
  const v = new Map(nodes.map((n) => [n.id, { x: 0, y: 0 }]))
  for (let it = 0; it < iters; it++) {
    for (const a of nodes) for (const b of nodes) {
      if (a === b) continue
      const dx = a.x - b.x, dy = a.y - b.y
      const d2 = Math.max(dx * dx + dy * dy, 4)
      const f = 2500 / d2
      const va = v.get(a.id)!
      va.x += (dx / Math.sqrt(d2)) * f
      va.y += (dy / Math.sqrt(d2)) * f
    }
    for (const e of edges) {
      const a = idx.get(e.s), b = idx.get(e.t)
      if (!a || !b) continue
      const dx = b.x - a.x, dy = b.y - a.y
      const d = Math.sqrt(dx * dx + dy * dy) || 1
      const f = (d - 70) * 0.03
      const va = v.get(a.id)!, vb = v.get(b.id)!
      va.x += (dx / d) * f; va.y += (dy / d) * f
      vb.x -= (dx / d) * f; vb.y -= (dy / d) * f
    }
    for (const n of nodes) {
      const vn = v.get(n.id)!
      vn.x += (W / 2 - n.x) * 0.003; vn.y += (H / 2 - n.y) * 0.003
      n.x += vn.x * 0.4; n.y += vn.y * 0.4
      vn.x *= 0.55; vn.y *= 0.55
    }
  }
}

export function NeuralMap() {
  const { files, docs, openFile, setTab, graph, refreshGraph } = useStore()
  const [layers, setLayers] = useState<Set<string>>(new Set(['character', 'location', 'prop', 'scene']))
  const [q, setQ] = useState('')
  const [view, setView] = useState({ x: 0, y: 0, k: 1 })
  const [nodes, setNodes] = useState<Node[]>([])
  const svg = useRef<SVGSVGElement>(null)
  const W = 1200, H = 800

  const built = useMemo(() => {
    const cards = breakdown(files, docs)
    const ns: Node[] = []
    const es: Edge[] = []
    const seen = new Set<string>()
    const add = (n: Omit<Node, 'x' | 'y' | 'deg'>) => { if (!seen.has(n.id)) { seen.add(n.id); ns.push({ ...n, x: 0, y: 0, deg: 0 }) } }
    for (const c of cards) add({ id: c.path, kind: c.kind, label: c.name })
    for (const f of files.filter((x) => x.kind === 'script')) add({ id: f.path, kind: 'script', label: f.name })
    for (const c of cards) for (const a of c.appearances) {
      const sid = `${a.script}#${a.scene}`
      add({ id: sid, kind: 'scene', label: `#${a.scene + 1} ${a.heading.replace(/^(INT|EXT)[.\s]+/i, '').slice(0, 16)}` })
      es.push({ s: sid, t: c.path })
      es.push({ s: a.script, t: sid })
    }
    for (const e of es) { ns.find((n) => n.id === e.s)!.deg++; ns.find((n) => n.id === e.t)!.deg++ }
    ns.forEach((n, i) => { const a = (i / ns.length) * Math.PI * 2; n.x = W / 2 + Math.cos(a) * 300; n.y = H / 2 + Math.sin(a) * 250 })
    force(ns, es, W, H, 250)
    return { ns, es }
  }, [files, docs])

  useEffect(() => setNodes(built.ns.map((n) => ({ ...n }))), [built])

  const visible = (n: Node) => n.kind === 'script' || layers.has(n.kind)
  const vis = new Set(nodes.filter(visible).map((n) => n.id))
  const ql = q.toLowerCase()
  const hit = (n: Node) => ql && n.label.toLowerCase().includes(ql)
  const byId = new Map(nodes.map((n) => [n.id, n]))

  const dragNode = (id: string) => (e: React.PointerEvent) => {
    e.stopPropagation()
    const move = (ev: PointerEvent) => setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, x: n.x + ev.movementX / view.k, y: n.y + ev.movementY / view.k } : n)))
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  const pan = (e: React.PointerEvent) => {
    const move = (ev: PointerEvent) => setView((v) => ({ ...v, x: v.x + ev.movementX, y: v.y + ev.movementY }))
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    void e
  }
  const wheel = (e: React.WheelEvent) => setView((v) => ({ ...v, k: Math.max(0.3, Math.min(3, v.k * (e.deltaY < 0 ? 1.1 : 0.9))) }))

  return (
    <main className="page">
      <div className="toolbar">
        {LAYERS.map(([k, l]) => (
          <button key={k} className={layers.has(k) ? 'on' : 'ghost'} style={{ borderColor: COLOR[k] }} onClick={() => setLayers((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })}>● {l}</button>
        ))}
        <input placeholder="Buscar nodo…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="grow" />
        <span className="muted tiny">{graph?.reason}</span>
        <button className="ghost" onClick={() => void refreshGraph(true)}>Reindexar</button>
        <button className="ghost" onClick={() => { setView({ x: 0, y: 0, k: 1 }); setNodes(built.ns.map((n) => ({ ...n }))) }}>Reordenar</button>
      </div>
      <svg ref={svg} className="map" viewBox={`0 0 ${W} ${H}`} onPointerDown={pan} onWheel={wheel}>
        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
          {built.es.map((e, i) => {
            const a = byId.get(e.s), b = byId.get(e.t)
            if (!a || !b || !vis.has(a.id) || !vis.has(b.id)) return null
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={hit(a) || hit(b) ? '#fff8' : '#ffffff18'} />
          })}
          {nodes.filter(visible).map((n) => {
            const r = 4 + Math.min(14, Math.sqrt(n.deg) * 2.2)
            const dim = ql && !hit(n)
            return (
              <g key={n.id} transform={`translate(${n.x},${n.y})`} opacity={dim ? 0.25 : 1} onPointerDown={dragNode(n.id)} onDoubleClick={() => { const p = n.id.split('#')[0]!; if (n.kind !== 'scene' || n.id.includes('#')) { void openFile(p, n.kind === 'scene' ? undefined : undefined); setTab('desk') } }} style={{ cursor: 'grab' }}>
                <circle r={r} fill={COLOR[n.kind]} stroke={hit(n) ? '#fff' : 'none'} strokeWidth={2} />
                <text x={r + 4} y={4} fontSize={n.kind === 'scene' ? 9 : 11} fill={n.kind === 'scene' ? 'var(--dim)' : 'var(--fg)'}>{n.label}</text>
              </g>
            )
          })}
        </g>
      </svg>
    </main>
  )
}
