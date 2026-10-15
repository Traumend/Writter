import { expect, test } from 'vitest'
import { trajectory } from '../../src/core/trajectory'
import type { Doc, FileEntry } from '../../src/core/types/ipc'

// El ejemplo del autor: el protagonista obtiene la espada legendaria en España en el capítulo 10 y
// estamos escribiendo el 8. La IA debe recibir ese hito y saber que aún no está sembrado.
const files: FileEntry[] = [
  { path: 'scripts/E10.md', kind: 'script', name: 'E10' },
  { path: 'scripts/E08.md', kind: 'script', name: 'E08' },
  { path: 'scripts/E09.md', kind: 'script', name: 'E09' },
  { path: 'entities/characters/Arata.md', kind: 'character', name: 'Arata' },
  { path: 'entities/characters/Kenji.md', kind: 'character', name: 'Kenji' },
  { path: 'outline/Planning.md', kind: 'outline', name: 'Planning' }
]
const script = (ep: number, body: string) => `---\ntype: script\nseason: 1\nepisode: ${ep}\n---\n\n${body}`
const docs: Doc[] = [
  { path: 'scripts/E08.md', content: script(8, 'INT. TALLER - NOCHE\n\nARATA\nNo puedo seguir así.\n\nEXT. PUERTO - DÍA\n\nKENJI\nZarpamos.\n') },
  { path: 'scripts/E09.md', content: script(9, 'INT. AVIÓN - DÍA\n\nARATA\nMadrid.\n') },
  { path: 'scripts/E10.md', content: script(10, 'INT. CATEDRAL - NOCHE\n\nARATA\nLa espada.\n') },
  { path: 'outline/E08.md', content: '---\ntype: outline\nsummary: Arata pierde el taller.\nsceneMeta:\n  INT. TALLER - NOCHE:\n    summary: Arata cierra el taller.\n---\n' },
  { path: 'outline/E09.md', content: '---\ntype: outline\nsceneMeta:\n  INT. AVIÓN - DÍA:\n    status: planned\n    purpose: Llegar a España.\n---\n' },
  {
    path: 'entities/characters/Arata.md',
    content: '---\naliases: [El Herrero]\narc_points:\n  - stage: Punto de partida\n    note: Herrero sin rumbo.\n    ref: { script: scripts/E08.md, heading: INT. TALLER - NOCHE }\n  - stage: Cambio\n    note: Obtiene la espada legendaria en España.\n    ref: { script: scripts/E10.md, heading: INT. CATEDRAL - NOCHE }\n---\n\nEn el capítulo 10 deja de dudar. En el capítulo 3 perdió a su padre.\n'
  },
  { path: 'entities/characters/Kenji.md', content: '---\narc_points:\n  - stage: Cambio\n    note: Traiciona al grupo.\n    ref: { script: scripts/E10.md, heading: INT. CATEDRAL - NOCHE }\n---\n' },
  {
    path: 'outline/Planning.md',
    content: '---\nplants:\n  - id: p1\n    title: Espada legendaria\n    type: objeto\n    payoffs:\n      - { script: scripts/E10.md, heading: INT. CATEDRAL - NOCHE }\n    characters: [Arata]\n    notes: Forjada en Toledo.\n---\n'
  }
]

test('trayectoria: desde el cap. 8 ve lo planeado para después, solo de quien está en escena', () => {
  const t = trajectory(files, docs, { script: 'scripts/E08.md', scene: 0 })
  expect(t.text).toContain('Obtiene la espada legendaria en España') // arco futuro del personaje en escena
  expect(t.text).toContain('Herrero sin rumbo') // dónde está su arco ahora
  expect(t.text).toContain('Espada legendaria') // pago planeado
  expect(t.text).toContain('Llegar a España') // escena planeada del cap. 9
  expect(t.text).toContain('En el capítulo 10 deja de dudar') // plan escrito en prosa en la ficha
  expect(t.text).not.toContain('capítulo 3 perdió') // pasado: no es trayectoria
  expect(t.text).not.toContain('Traiciona al grupo') // Kenji no está en esta escena
  expect(t.missing).toEqual([{ id: 'p1', title: 'Espada legendaria' }]) // falta sembrarla antes del cap. 10
  // Orden por temporada/episodio, no por nombre de archivo: el cap. 10 va después del 9.
  expect(t.text.indexOf('Llegar a España')).toBeLessThan(t.text.indexOf('Obtiene la espada'))
})

test('trayectoria: una siembra anterior a la posición ya no falta', () => {
  const sown = docs.map((d) => (d.path === 'outline/Planning.md' ? { ...d, content: d.content.replace('    payoffs:', '    plant: { script: scripts/E08.md, heading: INT. TALLER - NOCHE }\n    payoffs:') } : d))
  expect(trajectory(files, sown, { script: 'scripts/E09.md', scene: 0 }).missing).toEqual([])
})
