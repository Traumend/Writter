import { parseFountain } from '../parser/fountain'
import { project } from '../projection'
import type { FileEntry, Graph, GraphEdge, GraphNode } from '../types/ipc'

// Capa determinista del grafo (D6, I8): enlaces [[ ]] + personajes en escena -> aristas. Sin LLM, offline.
// ponytail: grafo en memoria reconstruido desde disco; Graphify (Python) enriquece cuando está disponible.
export function buildGraph(files: FileEntry[], read: (path: string) => string, linkOpen = '[[', linkClose = ']]'): Graph {
  const byName = new Map(files.map((f) => [f.name.toLowerCase(), f]))
  const nodes = new Map<string, GraphNode>()
  const edges: GraphEdge[] = []
  const seen = new Set<string>()
  const addEdge = (e: GraphEdge) => {
    const k = `${e.source}|${e.target}|${e.kind}`
    if (!seen.has(k)) {
      seen.add(k)
      edges.push(e)
    }
  }
  for (const f of files) nodes.set(f.path, { id: f.path, kind: f.kind, label: f.name })

  for (const f of files) {
    const p = project(parseFountain(read(f.path)), linkOpen, linkClose)
    for (const l of p.links) {
      const t = byName.get(l.toLowerCase())
      const id = t?.path ?? `unresolved:${l}`
      if (!t) nodes.set(id, { id, kind: 'other', label: l })
      addEdge({ source: f.path, target: id, kind: 'references' })
    }
    if (f.kind === 'script') {
      for (const c of p.characters) {
        const t = byName.get(c.toLowerCase())
        if (t) addEdge({ source: f.path, target: t.path, kind: 'appears' })
      }
    }
  }
  return { nodes: [...nodes.values()], edges }
}
