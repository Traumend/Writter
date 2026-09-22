import { expect, test } from 'vitest'
import { nextActRange, pack } from '../../src/core/timeline'

test('pack: intervalos que se pisan van a subfilas; los contiguos comparten fila', () => {
  const r = pack([{ a: 0, b: 100, it: 'A' }, { a: 100, b: 200, it: 'B' }, { a: 50, b: 120, it: 'C' }, { a: 300, b: 320, it: 'D' }])
  const row = Object.fromEntries(r.map((x) => [x.it, x.row]))
  expect(row).toEqual({ A: 0, C: 1, B: 0, D: 0 })
  expect(r[0]?.rows).toBe(2)
  expect(pack([]).length).toBe(0)
})

test('nextActRange: hueco libre, partición del último y guion de una escena', () => {
  expect(nextActRange([{ from: 0, to: 4 }], 18)).toEqual({ acts: [{ from: 0, to: 4 }], from: 5, to: 17 })
  const split = nextActRange([{ from: 0, to: 17 }], 18)
  expect(split.acts).toEqual([{ from: 0, to: 8 }])
  expect([split.from, split.to]).toEqual([9, 17])
  expect(nextActRange([{ from: 0, to: 0 }], 1)).toEqual({ acts: [{ from: 0, to: 0 }], from: 0, to: 0 })
  expect(nextActRange([], 3)).toEqual({ acts: [], from: 0, to: 2 })
})
