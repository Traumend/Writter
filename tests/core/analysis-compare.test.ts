import { expect, test } from 'vitest'
import { compareAnalyses } from '../../src/core/analysis'
import type { SceneAnalysis } from '../../src/core/types/ipc'

const sc = (index: number, heading: string | undefined, tension: number, emotion = 'Neutral'): SceneAnalysis =>
  ({ index, heading, summary: '', emotion, intensity: 5, tension, attention: 5, commercial: 5, notes: [] })

test('compara por encabezado: escenas movidas, nuevas y cortadas con su delta', () => {
  const before = [sc(0, 'INT. TALLER - NOCHE', 3), sc(1, 'EXT. PUERTO - DÍA', 5), sc(2, 'INT. BAR - NOCHE', 6)]
  const after = [sc(0, 'EXT. PUERTO - DÍA', 8, 'Miedo'), sc(1, 'INT. TALLER - NOCHE', 3), sc(2, 'INT. AVIÓN - DÍA', 4)]
  const rows = compareAnalyses(before, after)
  const by = Object.fromEntries(rows.map((r) => [r.heading, r]))
  expect(by['EXT. PUERTO - DÍA']).toMatchObject({ status: 'moved', from: 1, to: 0, delta: { tension: 3, intensity: 0 }, emotion: ['Neutral', 'Miedo'] })
  expect(by['INT. TALLER - NOCHE']).toMatchObject({ status: 'moved', delta: { tension: 0 } })
  expect(by['INT. AVIÓN - DÍA']).toMatchObject({ status: 'new', from: null, to: 2 })
  expect(by['INT. BAR - NOCHE']).toMatchObject({ status: 'cut', from: 2, to: null })
  expect(rows.map((r) => r.heading)).toEqual(['EXT. PUERTO - DÍA', 'INT. TALLER - NOCHE', 'INT. AVIÓN - DÍA', 'INT. BAR - NOCHE']) // orden nuevo; las cortadas al final
})

test('análisis antiguos sin encabezado: se emparejan por posición', () => {
  const rows = compareAnalyses([sc(0, undefined, 2), sc(1, undefined, 4)], [sc(0, undefined, 5)])
  expect(rows).toMatchObject([{ status: 'same', from: 0, to: 0, delta: { tension: 3 } }, { status: 'cut', from: 1, to: null }])
})
