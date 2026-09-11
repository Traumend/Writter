import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildGraph } from '../core/graph'
import type { Graph, GraphStatus } from '../core/types/ipc'
import { listFiles, readConfig, readFile, vaultRoot } from './vault'

// Orquestación de grafo (M2, D6). La capa determinista corre siempre en Node (I11).
// Graphify (Python) es opcional: si existe, se lanza `graphify` sobre el vault hacia .narrative/graphify-out.
let cache: Graph | null = null
let stale = true

export function markStale() {
  stale = true
}

export function getGraph(): Graph {
  if (!cache || stale) {
    const cfg = readConfig()
    const [open = '[[', close = ']]'] = cfg.tags.entity_link.split(/\s+/)
    cache = buildGraph(listFiles(), (p) => readFile(p).content, open, close)
    stale = false
  }
  return cache
}

function graphifyBin(): string | null {
  for (const bin of ['graphify', 'graphify.exe']) {
    const r = spawnSync(bin, ['--version'], { encoding: 'utf8', shell: process.platform === 'win32' })
    if (r.status === 0) return bin
  }
  return null
}

export function graphStatus(): GraphStatus {
  const g = getGraph()
  const bin = graphifyBin()
  const out = join(vaultRoot(), '.narrative/graphify-out/graph.json')
  return {
    available: true,
    nodes: g.nodes.length,
    edges: g.edges.length,
    stale,
    reason: bin ? (existsSync(out) ? 'Graphify: índice semántico presente' : 'Graphify instalado, sin índice aún') : 'Graphify no instalado: solo capa determinista (uv tool install graphifyy)'
  }
}

// Build con Graphify si existe; si no, solo reconstruye la capa determinista (AC-11).
export function graphBuild(): GraphStatus {
  markStale()
  const bin = graphifyBin()
  if (bin && readConfig().graphify.enabled) {
    const root = vaultRoot()
    const r = spawnSync(bin, ['.', '--output', '.narrative/graphify-out', '--no-viz'], { cwd: root, encoding: 'utf8', shell: process.platform === 'win32', timeout: 120_000 })
    if (r.status !== 0) return { ...graphStatus(), reason: `Graphify falló: ${(r.stderr || r.stdout).slice(-300)}` }
    const gj = join(root, '.narrative/graphify-out/graph.json')
    if (existsSync(gj)) {
      // Mezcla nodos/aristas semánticas de Graphify con la capa determinista.
      try {
        const ext = JSON.parse(readFileSync(gj, 'utf8')) as { nodes?: { id: string; label?: string }[]; edges?: { source: string; target: string }[] }
        const g = getGraph()
        for (const n of ext.nodes ?? []) if (!g.nodes.some((x) => x.id === n.id)) g.nodes.push({ id: n.id, kind: 'other', label: n.label ?? n.id })
        for (const e of ext.edges ?? []) g.edges.push({ source: e.source, target: e.target, kind: 'references' })
      } catch {
        /* graph.json ilegible: se queda la capa determinista */
      }
    }
  }
  return graphStatus()
}
