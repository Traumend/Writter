import { expect, test } from 'vitest'
import { breakdown, extractMissing, toCsv } from '../../src/core/breakdown'
import { doctor } from '../../src/core/doctor'
import { readFrontmatter, writeFrontmatter } from '../../src/core/frontmatter'
import { paginate } from '../../src/core/paginate'
import { parseFountain } from '../../src/core/parser/fountain'
import { project } from '../../src/core/projection'
import { moveScene } from '../../src/core/scenes'

const EP = `---
type: script
season: 1
episode: 1
---

INT. COCINA - DÍA

[[Summer]] habla por teléfono.

SUMMER
Hola.

EXT. TITANIC 2 - DECK - DAY

JERRY
Mira la fila.

INT. GARAJE - NOCHE

RICK
${'bla '.repeat(130)}
`

test('frontmatter: leer y escribir preservando cuerpo', () => {
  const t = writeFrontmatter(EP, { title: 'Piloto', episode: undefined })
  const { data, body } = readFrontmatter(t)
  expect(data).toEqual({ type: 'script', season: 1, title: 'Piloto' })
  expect(body).toContain('INT. COCINA - DÍA')
  expect(writeFrontmatter('sin fm', { a: 1 })).toBe('---\na: 1\n---\n\nsin fm')
})

test('mover escena reordena bloques', () => {
  const p = project(parseFountain(EP))
  const moved = moveScene(EP, p.scenes, 2, 0)
  const p2 = project(parseFountain(moved))
  expect(p2.scenes.map((s) => s.heading)).toEqual(['INT. GARAJE - NOCHE', 'INT. COCINA - DÍA', 'EXT. TITANIC 2 - DECK - DAY'])
  expect(readFrontmatter(moved).data['season']).toBe(1)
})

test('paginación estima páginas y saltos', () => {
  const long = 'INT. A - DÍA\n\n' + 'Acción de una línea.\n\n'.repeat(80)
  const pg = paginate(parseFountain(long).tokens)
  expect(pg.pages).toBeGreaterThanOrEqual(3)
  expect(pg.pageStarts.length).toBe(pg.pages - 1)
  expect(paginate(parseFountain(EP).tokens).pages).toBe(1)
})

test('breakdown: apariciones, alias, locaciones, csv, extracción', () => {
  const files = [
    { path: 'scripts/ep01.md', kind: 'script' as const, name: 'ep01' },
    { path: 'entities/characters/Summer.md', kind: 'character' as const, name: 'Summer' },
    { path: 'entities/characters/Rick.md', kind: 'character' as const, name: 'Rick' },
    { path: 'entities/locations/Titanic 2.md', kind: 'location' as const, name: 'Titanic 2' }
  ]
  const docs = [
    { path: 'scripts/ep01.md', content: EP },
    { path: 'entities/characters/Summer.md', content: '---\ngroup: protagonist\n---\n' },
    { path: 'entities/characters/Rick.md', content: '---\naliases: [RICK SANCHEZ]\n---\n' },
    { path: 'entities/locations/Titanic 2.md', content: '' }
  ]
  const cards = breakdown(files, docs)
  const summer = cards.find((c) => c.name === 'Summer')!
  expect(summer.group).toBe('protagonist')
  expect(summer.appearances.map((a) => a.scene)).toEqual([0])
  expect(summer.words).toBe(1)
  expect(cards.find((c) => c.name === 'Titanic 2')!.appearances.map((a) => a.scene)).toEqual([1])
  expect(cards.find((c) => c.name === 'Rick')!.appearances.length).toBe(1)
  expect(toCsv(cards)).toContain('"character","Summer","protagonist"')
  const miss = extractMissing(files, docs)
  expect(miss.characters).toEqual(['JERRY'])
  expect(miss.locations).toEqual(['COCINA', 'GARAJE'])
})

test('script doctor: parlamento largo y enlace sin ficha', () => {
  const doc = parseFountain(EP)
  const { findings, stats } = doctor(doc, project(doc), new Set(['summer']))
  expect(stats.length).toBe(3)
  expect(findings.some((f) => f.message.includes('muy largo'))).toBe(true)
  expect(findings.some((f) => f.message.includes('[[Summer]]'))).toBe(false)
})
