import { useEffect, useState } from 'react'
import type { Graph } from '../core/types/ipc'
import { useStore } from './store'

// Vista de grafo: SVG + layout de fuerzas mínimo. ponytail: Cytoscape cuando haga falta zoom/pan/clustering.
const COLOR: Record<string, string> = { script: '#4f8cff', character: '#ff6b9d', location: '#3ddc97', prop: '#f5c542', outline: '#b388ff', knowledge: '#8b91a0', other: '#555', scene: '#4f8cff' }

type P = { id: string; x: number; y: number; vx: number; vy: number }

function layout(g: Graph, w: number, h: number): Map<string, P> {
  const pts = new Map<string, P>()
  g.nodes.forEach((n, i) => {
    const a = (i / g.nodes.length) * Math.PI * 2
    pts.set(n.id, { id: n.id, x: w / 2 + Math.cos(a) * w * 0.35, y: h / 2 + Math.sin(a) * h * 0.35, vx: 0, vy: 0 })
  })
  const arr = [...pts.values()]
  for (let it = 0; it < 200; it++) {
    for (const a of arr) for (const b of arr) {
      if (a === b) continue
      const dx = a.x - b.x, dy = a.y - b.y
      const d2 = Math.max(dx * dx + dy * dy, 1)
      const f = 1800 / d2
      a.vx += (dx / Math.sqrt(d2)) * f
      a.vy += (dy / Math.sqrt(d2)) * f
    }
    for (const e of g.edges) {
      const a = pts.get(e.source), b = pts.get(e.target)
      if (!a || !b) continue
      const dx = b.x - a.x, dy = b.y - a.y
      const d = Math.sqrt(dx * dx + dy * dy) || 1
      const f = (d - 90) * 0.02
      a.vx += (dx / d) * f; a.vy += (dy / d) * f
      b.vx -= (dx / d) * f; b.vy -= (dy / d) * f
    }
    for (const p of arr) {
      p.vx += (w / 2 - p.x) * 0.005; p.vy += (h / 2 - p.y) * 0.005
      p.x = Math.max(20, Math.min(w - 20, p.x + p.vx * 0.5)); p.y = Math.max(20, Math.min(h - 20, p.y + p.vy * 0.5))
      p.vx *= 0.6; p.vy *= 0.6
    }
  }
  return pts
}

export function GraphView() {
  const [g, setG] = useState<Graph | null>(null)
  const graph = useStore((s) => s.graph)
  const openFile = useStore((s) => s.openFile)
  const W = 300, H = 260
  useEffect(() => {
    void window.api.graphGet().then(setG)
  }, [graph])
  if (!g) return <p className="muted">Sin grafo.</p>
  const pts = layout(g, W, H)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="graph">
      {g.edges.map((e, i) => {
        const a = pts.get(e.source), b = pts.get(e.target)
        return a && b ? <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={e.kind === 'appears' ? '#ff6b9d55' : '#ffffff22'} /> : null
      })}
      {g.nodes.map((n) => {
        const p = pts.get(n.id)!
        return (
          <g key={n.id} onClick={() => !n.id.startsWith('unresolved:') && void openFile(n.id)} style={{ cursor: 'pointer' }}>
            <circle cx={p.x} cy={p.y} r={n.kind === 'script' ? 7 : 5} fill={COLOR[n.kind] ?? '#555'} opacity={n.id.startsWith('unresolved:') ? 0.4 : 1} />
            <text x={p.x + 8} y={p.y + 3} fontSize="8" fill="var(--dim)">{n.label}</text>
          </g>
        )
      })}
    </svg>
  )
}
