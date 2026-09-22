import { expect, test } from 'vitest'
import { clinic } from '../../src/core/clinic'
import { premises } from '../../src/core/cmm'
import { LIBRARY, SUGGEST, byId } from '../../src/core/library'
import { ARC_STAGES, SCENE_FIELDS, defaultArc, readArc, readMotivation, readPlanning, readSceneMeta, resolveRef, type SceneMeta } from '../../src/core/planning'

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
      goal: 0, dailyGoal: 0, logline: '', synopsis: '', genre: '', status: 'idea',
      tracks: [{ id: 't1', name: 'Romance', color: '#fff' }],
      questions: [{ id: 'q', text: '¿Quién?', category: '', status: 'answered', importance: 2, beats: [], introduced: { script: 's.md', heading: 'INT. S1 - DÍA' }, resolved: { script: 's.md', heading: 'INT. S2 - DÍA' }, characters: [], notes: '' }],
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

test('readPlanning lee la ficha del proyecto, la meta diaria y los hitos de una pregunta', () => {
  const p = readPlanning('---\ntype: planning\ngoal: 90000\ndailyGoal: 800\nlogline: "Un ladrón honesto"\ngenre: Thriller\nstatus: drafting\nquestions:\n  - text: "¿Vuelve?"\n    beats:\n      - { script: s.md, heading: "INT. A" }\n---\n')
  expect([p.goal, p.dailyGoal]).toEqual([90000, 800])
  expect([p.logline, p.genre, p.status]).toEqual(['Un ladrón honesto', 'Thriller', 'drafting'])
  expect(p.questions[0]?.beats).toEqual([{ script: 's.md', heading: 'INT. A' }])
  // Estado desconocido -> idea; sin hitos -> lista vacía.
  const q = readPlanning('---\nstatus: inventado\nquestions: [{ text: x }]\n---\n')
  expect([q.status, q.questions[0]?.beats]).toEqual(['idea', []])
})

test('readArc lee los hitos del arco y defaultArc propone las seis etapas', () => {
  const arc = readArc({ arc_points: [{ id: 'a', stage: 'Crisis', note: 'pierde a su hermano', ref: { script: 's.md', heading: 'INT. A' } }, { note: 'sin etapa' }] })
  expect(arc[0]?.ref?.heading).toBe('INT. A')
  expect(arc[1]?.stage).toBe(ARC_STAGES[1]) // sin etapa explícita: se numera por posición
  expect(readArc({}).length).toBe(0)
  expect(defaultArc().map((p) => p.stage)).toEqual(ARC_STAGES)
})

test('clinic avisa de arco sin hitos, locación sin escenas y pregunta sin desarrollo intermedio', () => {
  const scenes = Array.from({ length: 12 }, (_, i) => ({ heading: `INT. S${i} - DÍA`, characters: ['A'], wordCount: 100, minutes: 1 }))
  const base = {
    scripts: [{ path: 's.md', name: 's', scenes, acts: [{ title: 'A1', from: 0, to: 5 }, { title: 'A2', from: 6, to: 11 }], sceneMeta: {} }],
    planning: {
      goal: 0, dailyGoal: 0, logline: '', synopsis: '', genre: '', status: 'idea' as const, tracks: [], plants: [], ideas: [],
      questions: [{ id: 'q', text: '¿Vuelve?', category: '', status: 'answered' as const, importance: 2, beats: [], introduced: { script: 's.md', heading: 'INT. S0 - DÍA' }, resolved: { script: 's.md', heading: 'INT. S9 - DÍA' }, characters: [], notes: '' }]
    }
  }
  const titles = clinic({ ...base, characters: [{ name: 'A', group: 'protagonist', appearances: 12, relationships: [] }], locations: [{ name: 'Hotel Aurora', appearances: 0 }] }).map((i) => i.title).join('\n')
  expect(titles).toMatch(/A: arco sin hitos/)
  expect(titles).toMatch(/Locación "Hotel Aurora" sin escenas/)
  expect(titles).toMatch(/sin desarrollo intermedio/)

  // Con hitos intermedios y arco anclado a escenas, esos avisos desaparecen.
  const q = { ...base.planning.questions[0]!, beats: [{ script: 's.md', heading: 'INT. S4 - DÍA' }] }
  const clean = clinic({
    scripts: base.scripts,
    planning: { ...base.planning, questions: [q] },
    characters: [{ name: 'A', group: 'protagonist', appearances: 12, relationships: [], arcPoints: 3, arcLinked: 2 }],
    locations: [{ name: 'Hotel Aurora', appearances: 4 }]
  }).map((i) => i.title).join('\n')
  expect(clean).not.toMatch(/arco sin hitos|sin escenas|sin desarrollo intermedio/)
})

test('clinic: escenas fuera de los actos, curva de tensión, motivación vacía y nombres sin ficha', () => {
  const scenes = Array.from({ length: 10 }, (_, i) => ({ heading: `INT. S${i} - DÍA`, characters: ['A'], wordCount: 100, minutes: 1 }))
  const planning = { goal: 0, dailyGoal: 0, logline: '', synopsis: '', genre: '', status: 'idea' as const, tracks: [], questions: [], plants: [], ideas: [] }
  const beats = [{ scene: 0, tension: 9 }, { scene: 2, tension: 8 }, { scene: 6, tension: 3 }, { scene: 9, tension: 2 }]
  const issues = clinic({
    scripts: [{ path: 's.md', name: 's', scenes, acts: [{ title: 'A1', from: 0, to: 6 }], sceneMeta: {}, beats }],
    characters: [{ name: 'A', group: 'protagonist', appearances: 10, relationships: [], arcPoints: 2, arcLinked: 1, motDims: 0 }],
    missing: { characters: ['ZORAIDA'], locations: ['PUENTE VIEJO'] },
    planning
  })
  const titles = issues.map((i) => i.title).join('\n')
  expect(titles).toMatch(/3 escena\(s\) fuera de los actos/)
  expect(titles).toMatch(/la tensión no sube hacia el final/)
  expect(titles).toMatch(/A: sin motivación definida/)
  expect(titles).toMatch(/ZORAIDA: habla en el guion y no tiene ficha/)
  expect(titles).toMatch(/PUENTE VIEJO: locación del guion sin ficha/)
  expect(issues.filter((i) => i.area === 'motivation' || i.area === 'continuity').every((i) => i.techniques.length > 0)).toBe(true)

  // Con beats sin tensión anotada el aviso cambia de tono (dato incompleto, no juicio).
  const flat = clinic({
    scripts: [{ path: 's.md', name: 's', scenes, acts: [{ title: 'A1', from: 0, to: 9 }], sceneMeta: {}, beats: beats.map((b) => ({ scene: b.scene })) }],
    characters: [], planning
  })
  expect(flat.map((i) => i.title).join('\n')).toMatch(/beats sin tensión anotada/)
})

test('SCENE_FIELDS cubre la ficha narrativa de la escena y son claves de SceneMeta', () => {
  expect(SCENE_FIELDS.map(([k]) => k)).toEqual(['summary', 'purpose', 'conflict', 'outcome', 'stakes', 'value'])
  const meta: SceneMeta = Object.fromEntries(SCENE_FIELDS.map(([k]) => [k, 'x']))
  expect(meta.summary).toBe('x')
})
