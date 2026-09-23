import { expect, test } from 'vitest'
import { activeFor, changes, colorOf, nextColor, nextNumber, sceneHashes, type Revision } from '../../src/core/revisions'
import { parseFountain } from '../../src/core/parser/fountain'
import { project } from '../../src/core/projection'

const TEXT = 'INT. A - DÍA\n\nAna entra.\n\nEXT. B - NOCHE\n\nBeto espera.\n'
const hashesOf = (text: string) => sceneHashes(project(parseFountain(text)).scenes, text)

test('sceneHashes es estable y cambia solo si cambia el contenido de la escena', () => {
  const a = hashesOf(TEXT)
  expect(Object.keys(a)).toEqual(['INT. A - DÍA', 'EXT. B - NOCHE'])
  expect(hashesOf(TEXT)).toEqual(a) // determinista
  const b = hashesOf(TEXT.replace('Ana entra.', 'Ana entra y cierra.'))
  expect(b['INT. A - DÍA']).not.toBe(a['INT. A - DÍA'])
  expect(b['EXT. B - NOCHE']).toBe(a['EXT. B - NOCHE'])
})

test('changes separa modificadas, nuevas y desaparecidas', () => {
  const base = hashesOf(TEXT)
  const now = hashesOf(TEXT.replace('Ana entra.', 'Ana entra y cierra.').replace('EXT. B - NOCHE\n\nBeto espera.\n', 'INT. C - DÍA\n\nNueva escena.\n'))
  const c = changes(base, now)
  expect(c.modified).toEqual(['INT. A - DÍA'])
  expect(c.added).toEqual(['INT. C - DÍA'])
  expect(c.removed).toEqual(['EXT. B - NOCHE'])
  expect(changes(base, base)).toEqual({ modified: [], added: [], removed: [] })
})

test('nextNumber sigue la convención de numeración bloqueada', () => {
  expect(nextNumber('5', [])).toBe('5A')
  expect(nextNumber('5', ['5A'])).toBe('5B')
  expect(nextNumber('5A', ['5A', '5B'])).toBe('5C')
  expect(nextNumber('A12', [])).toBe('A12A')
  expect(nextNumber(undefined, [])).toBe('1')
})

test('colores y revisión activa por alcance', () => {
  expect(nextColor([])).toBe('White Draft')
  const r1: Revision = { id: 'r1', numero: 1, color: 'White Draft', fecha: '', motivo: '', alcance: 'proyecto', base: {} }
  const r2: Revision = { id: 'r2', numero: 2, color: 'Blue', fecha: '', motivo: '', alcance: 'episodio', script: 'scripts/E1.md', base: {} }
  expect(nextColor([r1])).toBe('Blue')
  expect(activeFor([r1, r2], 'scripts/E1.md')?.id).toBe('r2')
  expect(activeFor([r1, r2], 'scripts/E2.md')?.id).toBe('r1')
  expect(activeFor([], 'scripts/E1.md')).toBeUndefined()
  expect(colorOf('Blue')).toMatch(/^#/)
  expect(colorOf('inventado')).toMatch(/^#/)
})
