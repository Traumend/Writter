import type { SceneAnalysis } from '../types/ipc'

// Comparación entre dos versiones de un análisis (ScriptWriterX "da"): escena a escena, emparejadas
// por encabezado para que reordenar, añadir o cortar escenas no descuadre la comparación. Los
// análisis antiguos no guardaban encabezado: esos se emparejan por posición.
export const METRICS = ['intensity', 'tension', 'attention', 'commercial'] as const
export type Metric = (typeof METRICS)[number]
export type CompareRow = {
  heading: string
  status: 'same' | 'moved' | 'new' | 'cut'
  from: number | null
  to: number | null
  delta: Record<Metric, number>
  emotion: [string, string]
}

const key = (s: SceneAnalysis, byHeading: boolean) => (byHeading ? (s.heading ?? '').trim().toUpperCase() : String(s.index))

export function compareAnalyses(before: SceneAnalysis[], after: SceneAnalysis[]): CompareRow[] {
  const byHeading = [...before, ...after].every((s) => s.heading)
  const old = new Map(before.map((s) => [key(s, byHeading), s]))
  const zero = Object.fromEntries(METRICS.map((m) => [m, 0])) as Record<Metric, number>
  const rows: CompareRow[] = after.map((b) => {
    const a = old.get(key(b, byHeading))
    old.delete(key(b, byHeading))
    if (!a) return { heading: b.heading ?? `#${b.index + 1}`, status: 'new', from: null, to: b.index, delta: zero, emotion: ['', b.emotion] }
    return {
      heading: b.heading ?? `#${b.index + 1}`,
      status: a.index === b.index ? 'same' : 'moved',
      from: a.index,
      to: b.index,
      delta: Object.fromEntries(METRICS.map((m) => [m, b[m] - a[m]])) as Record<Metric, number>,
      emotion: [a.emotion, b.emotion]
    }
  })
  for (const a of old.values()) rows.push({ heading: a.heading ?? `#${a.index + 1}`, status: 'cut', from: a.index, to: null, delta: zero, emotion: [a.emotion, ''] })
  return rows
}
