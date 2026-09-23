import { expect, test } from 'vitest'
import { suggestAt, TIMES, TRANSITIONS } from '../../src/core/editor/complete'

const at = (line: string, prev: Parameters<typeof suggestAt>[2] = 'blank') => suggestAt(line, line.length, prev)

test('sugiere lugar tras el prefijo del encabezado y momento del día tras el guion', () => {
  expect(at('INT. COC')).toEqual({ kind: 'location', from: 5 })
  expect(at('EXT. ')).toEqual({ kind: 'location', from: 5 })
  expect(at('.AZOT')).toEqual({ kind: 'location', from: 1 })
  expect(at('INT. COCINA - NO')).toEqual({ kind: 'time', from: 14 })
  expect(at('INT. COCINA DE ANA - ')).toEqual({ kind: 'time', from: 21 })
  expect(TIMES).toContain('NOCHE')
})

test('sugiere transición tras ">" y personaje en línea nueva', () => {
  expect(at('> COR')).toEqual({ kind: 'transition', from: 2 })
  expect(TRANSITIONS.some((x) => x.startsWith('CORTE A'))).toBe(true)
  expect(at('AN')).toEqual({ kind: 'character', from: 0 })
  expect(at('ANA', 'dialogue')).toEqual({ kind: 'character', from: 0 })
})

test('no sugiere dentro de una acción ya escrita ni tras un personaje', () => {
  expect(at('Ana apaga la luz y sale.')).toBeNull()
  expect(at('No vuelvas a llamar.', 'character')).toBeNull()
  expect(at('   ')).toBeNull()
})
