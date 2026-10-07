import { expect, test } from 'vitest'
import { budgetTotals, dayCast, dood, eighths, itemTotal, sceneKey, type BudgetItem, type ShootingDay } from '../../src/core/preproduction'

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

test('budgetTotals suma por grupo y aplica la contingencia', () => {
  const items: BudgetItem[] = [
    { id: '1', group: 'ATL', category: '1300', description: 'Dirección', qty: 1, unit: 'semana', rate: 1000, days: 4 },
    { id: '2', group: 'BTL', category: '3300', description: 'Cámara', qty: 2, unit: 'día', rate: 250, days: 10 },
    { id: '3', group: 'POST', category: '5200', description: 'Montaje', qty: 1, unit: 'global', rate: 3000, days: 1 }
  ]
  expect(itemTotal(items[0]!)).toBe(4000)
  const t = budgetTotals(items, 10)
  expect(t.byGroup).toEqual({ ATL: 4000, BTL: 5000, POST: 3000 })
  expect(t.subtotal).toBe(12000)
  expect(t.contingency).toBe(1200)
  expect(t.total).toBe(13200)
  expect(budgetTotals([], 10).total).toBe(0)
})
