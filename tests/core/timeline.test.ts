import { expect, test } from 'vitest'
import { nextActRange, pack } from '../../src/core/timeline'
import { toFcpxml } from '../../src/core/timeline/fcpxml'

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

test('toFcpxml coloca marcadores cuantizados a fotograma y escapa el texto', () => {
  const xml = toFcpxml('Piloto & "final"', [
    { name: 'Acto 1', start: 0, duration: 2 },
    { name: 'Midpoint <giro>', start: 1.5 }
  ], 3)
  expect(xml).toContain('<fcpxml version="1.9">')
  expect(xml).toContain('name="Piloto &amp; &quot;final&quot;"')
  expect(xml).toContain('<marker start="0/24s" duration="2880/24s" value="Acto 1"/>')
  expect(xml).toContain('value="Midpoint &lt;giro&gt;"')
  expect(xml).toContain('duration="4320/24s"') // 3 minutos de secuencia
  // Orden por tiempo aunque lleguen desordenados y duración mínima de un fotograma.
  const solo = toFcpxml('X', [{ name: 'B', start: 1 }, { name: 'A', start: 0 }], 1)
  expect(solo.indexOf('value="A"')).toBeLessThan(solo.indexOf('value="B"'))
  expect(solo).toContain('duration="1/24s"')
})
