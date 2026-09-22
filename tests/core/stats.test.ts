import { expect, test } from 'vitest'
import { dayKey, record, series, streak, written } from '../../src/core/stats'

test('record guarda el primer y el último total del día; written es la diferencia', () => {
  let log = record({}, 1000, '2026-09-20')
  expect(written(log, '2026-09-20')).toBe(0)
  log = record(log, 1250, '2026-09-20')
  expect(written(log, '2026-09-20')).toBe(250)
  // Borrar no resta del objetivo diario.
  log = record(log, 900, '2026-09-20')
  expect(written(log, '2026-09-20')).toBe(0)
  expect(written(log, '2026-09-21')).toBe(0)
})

test('streak cuenta días consecutivos y sobrevive a un día sin escribir todavía', () => {
  let log = {}
  for (const [day, from, to] of [['2026-09-18', 0, 100], ['2026-09-19', 100, 300], ['2026-09-20', 300, 500]] as const) {
    log = record(log, from, day)
    log = record(log, to, day)
  }
  expect(streak(log, '2026-09-20')).toBe(3)
  expect(streak(log, '2026-09-21')).toBe(3) // hoy aún sin escribir: la racha de ayer sigue viva
  expect(streak(log, '2026-09-22')).toBe(0) // dos días sin escribir: se rompe
  expect(streak({}, '2026-09-20')).toBe(0)
})

test('series devuelve los últimos días en orden y dayKey usa fecha local', () => {
  let log = record({}, 0, '2026-09-20')
  log = record(log, 400, '2026-09-20')
  const s = series(log, 3, '2026-09-21')
  expect(s.map((d) => d.day)).toEqual(['2026-09-19', '2026-09-20', '2026-09-21'])
  expect(s.map((d) => d.words)).toEqual([0, 400, 0])
  expect(dayKey(new Date(2026, 8, 5))).toBe('2026-09-05')
})
