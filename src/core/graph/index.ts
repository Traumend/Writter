// Grafo de la historia (Mapa neural): nodos tipados + aristas tipadas + estructura (componentes, puentes).
// Determinista (I9): misma entrada -> mismo grafo. Sin dependencias de Node.
import { breakdown, type Doc } from '../breakdown'
import { readFrontmatter } from '../frontmatter'
import { extractLinks, parseFountain } from '../parser/fountain'
import { project } from '../projection'
import type { FileEntry, FileKind, Graph, GraphEdge, GraphNode } from '../types/ipc'

// Capa determinista del grafo (D6, I8) usada por el proceso main: enlaces [[ ]] + personajes en escena.
export function buildGraph(files: FileEntry[], read: (path: string) => string, linkOpen = '[[', linkClose = ']]'): Graph {
  const byName = new Map(files.map((f) => [f.name.toLowerCase(), f]))
  const nodes = new Map<string, GraphNode>()
  const edges: GraphEdge[] = []
  const seen = new Set<string>()
  const addEdge = (e: GraphEdge) => {
    const k = `${e.source}|${e.target}|${e.kind}`
    if (!seen.has(k)) { seen.add(k); edges.push(e) }
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

export type NKind = FileKind | 'scene'
export type GNode = {
  id: string
  kind: NKind
  label: string
  group: string // grupo de personaje (protagonist…) o familia de lugar
  appear: number // nº de apariciones (0 = huérfano)
  scriptPath: string // guion al que pertenece (escenas); '' para entidades
  season: string
  episode: string
}
export type EdgeType = 'appears' | 'mentions' | 'scene' | 'traffic' | 'family' | 'group'
export type GEdge = { s: string; t: string; type: EdgeType; w: number }
export type BuiltGraph = { nodes: GNode[]; edges: GEdge[] }

const norm = (s: string) => s.trim().toUpperCase()
export const familyOf = (name: string) => (name.split(/\s+-\s+/)[0] ?? name).trim()

// Grafo enriquecido para el Mapa neural del renderer (aristas tipadas).
export function buildStoryGraph(files: FileEntry[], docs: Doc[]): BuiltGraph {
  const content = new Map(docs.map((d) => [d.path, d.content]))
  const cards = breakdown(files, docs)
  const byName = new Map<string, string>() // nombre/alias normalizado -> id (ruta)
  for (const c of cards) for (const n of [c.name, ...c.aliases]) byName.set(norm(n), c.path)

  const scriptMeta = new Map<string, { season: string; episode: string }>()
  for (const f of files.filter((x) => x.kind === 'script')) {
    const fm = readFrontmatter(content.get(f.path) ?? '').data
    scriptMeta.set(f.path, { season: String(fm['season'] ?? ''), episode: String(fm['episode'] ?? '') })
  }

  const nodes = new Map<string, GNode>()
  const add = (n: GNode) => { if (!nodes.has(n.id)) nodes.set(n.id, n) }

  for (const c of cards) {
    add({ id: c.path, kind: c.kind, label: c.name, group: c.kind === 'location' ? familyOf(c.name) : c.group, appear: c.appearances.length, scriptPath: '', season: '', episode: '' })
  }

  // Escenas como nodos (rombo en la UI). Una arista appears por (escena, entidad).
  const sceneChars = new Map<string, Set<string>>() // sid -> ids de entidades presentes
  const sceneLocs = new Map<string, string[]>() // sid -> ids de lugares presentes (para tráfico)
  const edges: GEdge[] = []
  const push = (s: string, t: string, type: EdgeType, w = 1) => { if (s !== t) edges.push({ s, t, type, w }) }

  for (const c of cards) {
    for (const a of c.appearances) {
      const sid = `${a.script}#${a.scene}`
      const meta = scriptMeta.get(a.script) ?? { season: '', episode: '' }
      add({ id: sid, kind: 'scene', label: `#${a.scene + 1} ${a.heading.replace(/^(INT|EXT|EST|I\/E|INT\.?\/EXT)[.\s]+/i, '').slice(0, 18)}`, group: '', appear: 0, scriptPath: a.script, season: meta.season, episode: meta.episode })
      push(sid, c.path, 'appears')
      if (!sceneChars.has(sid)) sceneChars.set(sid, new Set())
      if (c.kind === 'character') sceneChars.get(sid)!.add(c.path)
      if (c.kind === 'location') sceneLocs.set(sid, [...(sceneLocs.get(sid) ?? []), c.path])
    }
  }

  // Menciones: enlaces [[ ]] dentro de la ficha de una entidad hacia otra entidad.
  for (const c of cards) {
    for (const l of extractLinks(content.get(c.path) ?? '')) {
      const tid = byName.get(norm(l))
      if (tid && tid !== c.path) push(c.path, tid, 'mentions')
    }
  }

  // Escena <-> escena: comparten al menos un personaje (peso = nº compartidos).
  const sids = [...sceneChars.keys()]
  for (let i = 0; i < sids.length; i++) for (let j = i + 1; j < sids.length; j++) {
    const a = sceneChars.get(sids[i]!)!, b = sceneChars.get(sids[j]!)!
    let shared = 0
    for (const x of a) if (b.has(x)) shared++
    if (shared > 0) push(sids[i]!, sids[j]!, 'scene', shared)
  }

  // Tráfico entre lugares: escenas consecutivas del mismo guion con lugares distintos.
  const byScript = new Map<string, string[]>()
  for (const sid of new Set([...sceneChars.keys(), ...sceneLocs.keys()])) {
    const script = sid.slice(0, sid.lastIndexOf('#'))
    byScript.set(script, [...(byScript.get(script) ?? []), sid])
  }
  for (const list of byScript.values()) {
    const ordered = list.sort((x, y) => Number(x.slice(x.lastIndexOf('#') + 1)) - Number(y.slice(y.lastIndexOf('#') + 1)))
    for (let i = 0; i + 1 < ordered.length; i++) {
      for (const l1 of sceneLocs.get(ordered[i]!) ?? []) for (const l2 of sceneLocs.get(ordered[i + 1]!) ?? []) push(l1, l2, 'traffic')
    }
  }

  // Familias de lugar: lugares que comparten prefijo (MORTY'S HOME - ...).
  const fam = new Map<string, string[]>()
  for (const c of cards) if (c.kind === 'location') fam.set(familyOf(c.name), [...(fam.get(familyOf(c.name)) ?? []), c.path])
  for (const list of fam.values()) if (list.length > 1) for (let i = 1; i < list.length; i++) push(list[0]!, list[i]!, 'family')

  // Grupos: personajes del mismo grupo (protagonist/antagonist/…), en estrella.
  const grp = new Map<string, string[]>()
  for (const c of cards) if (c.kind === 'character' && c.group && c.group !== 'none') grp.set(c.group, [...(grp.get(c.group) ?? []), c.path])
  for (const list of grp.values()) if (list.length > 1) for (let i = 1; i < list.length; i++) push(list[0]!, list[i]!, 'group')

  // Deduplica aristas mismo par+tipo sumando peso.
  const merged = new Map<string, GEdge>()
  for (const e of edges) {
    const key = [e.s, e.t].sort().join('|') + '|' + e.type
    const prev = merged.get(key)
    if (prev) prev.w += e.w
    else merged.set(key, { ...e })
  }
  return { nodes: [...nodes.values()], edges: [...merged.values()] }
}

// Componentes conexos (para las "islas"): id de nodo -> índice de componente.
export function components(nodes: GNode[], edges: GEdge[]): Map<string, number> {
  const parent = new Map<string, string>()
  for (const n of nodes) parent.set(n.id, n.id)
  const find = (x: string): string => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x)!)!); x = parent.get(x)! } return x }
  const union = (a: string, b: string) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb) }
  for (const e of edges) if (parent.has(e.s) && parent.has(e.t)) union(e.s, e.t)
  const idx = new Map<string, number>()
  const roots = new Map<string, number>()
  for (const n of nodes) {
    const r = find(n.id)
    if (!roots.has(r)) roots.set(r, roots.size)
    idx.set(n.id, roots.get(r)!)
  }
  return idx
}

// Puntos de articulación (puentes críticos): nodos cuya eliminación desconecta el grafo.
// DFS de Tarjan iterativo (evita desbordar el stack en guiones grandes).
export function articulationPoints(nodes: GNode[], edges: GEdge[]): Set<string> {
  const adj = new Map<string, string[]>()
  for (const n of nodes) adj.set(n.id, [])
  for (const e of edges) { if (adj.has(e.s) && adj.has(e.t)) { adj.get(e.s)!.push(e.t); adj.get(e.t)!.push(e.s) } }
  const disc = new Map<string, number>()
  const low = new Map<string, number>()
  const art = new Set<string>()
  let timer = 0
  for (const start of nodes) {
    if (disc.has(start.id)) continue
    // pila: [nodo, padre, índice del siguiente vecino a explorar]
    const stack: [string, string | null, number][] = [[start.id, null, 0]]
    let rootChildren = 0
    while (stack.length) {
      const frame = stack[stack.length - 1]!
      const [u, parent, i] = frame
      if (i === 0) { disc.set(u, timer); low.set(u, timer); timer++ }
      const neigh = adj.get(u)!
      if (i < neigh.length) {
        frame[2]++
        const v = neigh[i]!
        if (v === parent) continue
        if (!disc.has(v)) {
          if (parent === null) rootChildren++
          stack.push([v, u, 0])
        } else low.set(u, Math.min(low.get(u)!, disc.get(v)!))
      } else {
        stack.pop()
        if (parent !== null) {
          low.set(parent, Math.min(low.get(parent)!, low.get(u)!))
          if (parent !== start.id && low.get(u)! >= disc.get(parent)!) art.add(parent)
        }
      }
    }
    if (rootChildren > 1) art.add(start.id)
  }
  return art
}
