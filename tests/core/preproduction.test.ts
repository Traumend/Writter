import { expect, test } from 'vitest'
import { dayCast, dood, eighths, sceneKey, type ShootingDay } from '../../src/core/preproduction'

const day = (id: string, scenes: string[]): ShootingDay => ({ id, date: '', call: '', location: '', scenes, notes: '' })

test('eighths expresa las páginas en octavos como el plan de rodaje', () => {
  expect(eighths(0)).toBe('1/8') // toda escena ocupa al menos un octavo
  expect(eighths(0.5)).toBe('4/8')
  expect(eighths(1)).toBe('1')
  expect(eighths(2.375)).toBe('2 3/8')
})

test('dood marca SW, W, H, WF, SWF y D por personaje y jornada', () => {
  const cast: Record<string, string[]> = { 'e1#A': ['ANA', 'BETO'], 'e1#B': ['ANA'], 'e1#C': ['BETO'], 'e1#D': ['CARLA'] }
  const days = [day('d1', ['e1#A']), day('d2', ['e1#D']), day('d3', ['e1#C']), day('d4', ['e1#B'])]
  const rows = dood(days, (k) => cast[k] ?? [])
  const byName = Object.fromEntries(rows.map((r) => [r.character, r.codes]))
  expect(byName['ANA']).toEqual(['SW', 'H', 'H', 'WF']) // empieza el 1, espera, y termina el 4
  expect(byName['BETO']).toEqual(['SW', 'H', 'WF', 'D'])
  expect(byName['CARLA']).toEqual(['D', 'SWF', 'D', 'D']) // un solo día: empieza, trabaja y termina
  expect(dayCast(days[0]!, (k) => cast[k] ?? [])).toEqual(['ANA', 'BETO'])
  expect(sceneKey('e1', 'A')).toBe('e1#A')
})
