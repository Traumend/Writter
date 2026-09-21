import { expect, test } from 'vitest'
import { clinic } from '../../src/core/clinic'
import { premises } from '../../src/core/cmm'
import { LIBRARY, SUGGEST, byId } from '../../src/core/library'
import { readMotivation, readPlanning, readSceneMeta, resolveRef } from '../../src/core/planning'

test('readPlanning tolera campos faltantes y desconocidos', () => {
  const p = readPlanning('---\ntype: planning\ngoal: 500\nquestions:\n  - text: "¿Quién?"\n    foo: bar\nplants: []\n---\n')
  expect(p.goal).toBe(500)
  expect(p.questions[0]?.status).toBe('open')
  expect(p.questions[0]?.importance).toBe(2)
  expect(p.tracks).toEqual([])
  expect(readPlanning(undefined).ideas).toEqual([])
})

test('resolveRef encuentra por encabezado (case-insensitive) o devuelve null', () => {
  const scenes = new Map([['s.md', ['INT. CASA - DÍA', 'EXT. CALLE - NOCHE']]])
  expect(resolveRef({ script: 's.md', heading: 'ext. calle - noche' }, scenes)).toBe(1)
  expect(resolveRef({ script: 's.md', heading: 'INT. NADA' }, scenes)).toBe(null)
  expect(resolveRef(undefined, scenes)).toBe(null)
})

test('readSceneMeta y readMotivation acotan valores', () => {
  expect(readSceneMeta('---\nsceneMeta:\n  "INT. A": { track: t1, status: draft }\n---\n')['INT. A']?.status).toBe('draft')
  const m = readMotivation({ motivation: { goal: { text: 'vengarse', level: 99 }, fear: { text: '' } } })
  expect(m.goal?.level).toBe(10)
  expect(m.fear?.level).toBe(5)
})

test('premises cruza ejes por reglas y ordena por intensidad', () => {
  const a = { name: 'Ana', motivation: { goal: { text: 'huir de la ciudad', level: 9 }, value: { text: 'su libertad', level: 8 } } }
  const b = { name: 'Bruno', motivation: { fear: { text: 'quedarse solo', level: 9 }, desire: { text: 'retenerla', level: 3 } } }
  const ps = premises(a, b)
  expect(ps.length).toBeGreaterThan(0)
  expect(ps[0]!.score).toBeGreaterThanOrEqual(ps[ps.length - 1]!.score)
  expect(ps[0]!.text).toContain('Ana')
  expect(premises(a, b, 'en')[0]!.text).toMatch(/Ana/)
})

test('la biblioteca es consistente: ids únicos, relacionados existentes, sugerencias válidas', () => {
  const ids = new Set(LIBRARY.map((e) => e.id))
  expect(ids.size).toBe(LIBRARY.length)
  for (const e of LIBRARY) for (const r of e.related) expect(byId(r), `${e.id} -> ${r}`).toBeTruthy()
  for (const list of Object.values(SUGGEST)) for (const id of list) expect(byId(id)).toBeTruthy()
})

test('clinic detecta siembra sin pago, pregunta inmediata y track inactivo', () => {
  const scenes = Array.from({ length: 10 }, (_, i) => ({ heading: `INT. S${i} - DÍA`, characters: i === 3 ? ['B'] : ['A'], wordCount: 100, minutes: 1 }))
  const sceneMeta: Record<string, { track?: string }> = { 'INT. S0 - DÍA': { track: 't1' }, 'INT. S9 - DÍA': { track: 't1' } }
  const issues = clinic({
    scripts: [{ path: 's.md', name: 's', scenes, acts: [{ title: 'A1', from: 0, to: 9 }], sceneMeta }],
    characters: [{ name: 'A', group: 'protagonist', appearances: 9, relationships: ['Z'] }],
    planning: {
      goal: 0,
      tracks: [{ id: 't1', name: 'Romance', color: '#fff' }],
      questions: [{ id: 'q', text: '¿Quién?', category: '', status: 'answered', importance: 2, introduced: { script: 's.md', heading: 'INT. S1 - DÍA' }, resolved: { script: 's.md', heading: 'INT. S2 - DÍA' }, characters: [], notes: '' }],
      plants: [{ id: 'p', title: 'Reloj roto', type: '', plant: { script: 's.md', heading: 'INT. S0 - DÍA' }, payoffs: [], characters: [], notes: '' }],
      ideas: []
    }
  })
  const titles = issues.map((i) => i.title).join('\n')
  expect(titles).toMatch(/siembra sin pago/)
  expect(titles).toMatch(/se responde de inmediato/)
  expect(titles).toMatch(/inactivo/)
  expect(titles).toMatch(/relación sin escena compartida/)
  expect(titles).toMatch(/B aparece una sola vez/)
  expect(issues.every((i) => i.techniques.length > 0)).toBe(true)
})
