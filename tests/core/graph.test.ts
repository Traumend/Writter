import { expect, test } from 'vitest'
import { articulationPoints, buildStoryGraph, components, type GEdge, type GNode } from '../../src/core/graph'
import type { FileEntry } from '../../src/core/types/ipc'

const n = (id: string): GNode => ({ id, kind: 'character', label: id, group: '', appear: 1, scriptPath: '', season: '', episode: '' })
const e = (s: string, t: string): GEdge => ({ s, t, type: 'mentions', w: 1 })

test('articulationPoints detecta el nodo puente de una cadena A-B-C', () => {
  const art = articulationPoints([n('A'), n('B'), n('C')], [e('A', 'B'), e('B', 'C')])
  expect([...art].sort()).toEqual(['B'])
})

test('un triángulo no tiene puntos de articulación', () => {
  const art = articulationPoints([n('A'), n('B'), n('C')], [e('A', 'B'), e('B', 'C'), e('C', 'A')])
  expect(art.size).toBe(0)
})

test('components separa nodos desconectados (islas)', () => {
  const idx = components([n('A'), n('B'), n('C'), n('D')], [e('A', 'B')])
  expect(idx.get('A')).toBe(idx.get('B'))
  expect(idx.get('C')).not.toBe(idx.get('A'))
  expect(new Set(idx.values()).size).toBe(3) // {A,B}, {C}, {D}
})

test('buildStoryGraph deriva apariciones y menciones', () => {
  const files: FileEntry[] = [
    { path: 'scripts/e1.md', kind: 'script', name: 'e1' },
    { path: 'chars/rick.md', kind: 'character', name: 'Rick' },
    { path: 'chars/morty.md', kind: 'character', name: 'Morty' }
  ]
  const docs = [
    { path: 'scripts/e1.md', content: '---\ntype: script\nseason: 1\nepisode: 10\n---\n\nINT. GARAGE - DAY\n\nRICK\nMorty, come here.\n\nMORTY\nOk.\n' },
    { path: 'chars/rick.md', content: '---\ntype: character\nname: Rick\n---\n\nAbuelo de [[Morty]].\n' },
    { path: 'chars/morty.md', content: '---\ntype: character\nname: Morty\n---\n\n' }
  ]
  const g = buildStoryGraph(files, docs)
  expect(g.nodes.some((x) => x.kind === 'scene')).toBe(true)
  expect(g.edges.some((x) => x.type === 'appears')).toBe(true)
  expect(g.edges.some((x) => x.type === 'mentions')).toBe(true)
  // La escena hereda season/episode del guion.
  expect(g.nodes.find((x) => x.kind === 'scene')?.episode).toBe('10')
})
