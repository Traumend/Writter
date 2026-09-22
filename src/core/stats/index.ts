// Estadísticas de escritura (PRD §98-100): registro diario local, sin contenido creativo.
// Guarda por día el total de palabras del proyecto al abrir y al cerrar; lo escrito es la diferencia.
// Así sobrevive a recargas y no depende de contar pulsaciones.
export type DayEntry = { first: number; last: number }
export type WriteLog = Record<string, DayEntry> // 'YYYY-MM-DD' -> totales del proyecto

export const dayKey = (d = new Date()): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const KEEP = 400 // días de historial (suficiente para rachas y gráficos; el resto se descarta)

// Anota el total de palabras del proyecto en el día indicado. Determinista: mismo log + mismo total -> mismo resultado.
export function record(log: WriteLog, total: number, day = dayKey()): WriteLog {
  const prev = log[day]
  const next: WriteLog = { ...log, [day]: prev ? { first: prev.first, last: total } : { first: total, last: total } }
  const days = Object.keys(next).sort()
  return days.length <= KEEP ? next : Object.fromEntries(days.slice(-KEEP).map((k) => [k, next[k]!]))
}

// Palabras netas escritas ese día (nunca negativo: borrar no resta del objetivo diario).
export const written = (log: WriteLog, day = dayKey()): number => Math.max(0, (log[day]?.last ?? 0) - (log[day]?.first ?? 0))

const shift = (day: string, n: number): string => { const [y, m, d] = day.split('-').map(Number); return dayKey(new Date(y!, m! - 1, d! + n)) }

// Racha de días consecutivos con escritura. Si hoy aún no se ha escrito, la racha de ayer sigue viva.
export function streak(log: WriteLog, today = dayKey()): number {
  let day = written(log, today) > 0 ? today : shift(today, -1)
  let n = 0
  while (written(log, day) > 0) { n++; day = shift(day, -1) }
  return n
}

// Serie de los últimos `days` días (para el gráfico del Dashboard), del más antiguo al más reciente.
export const series = (log: WriteLog, days = 14, today = dayKey()): { day: string; words: number }[] =>
  Array.from({ length: days }, (_, i) => { const day = shift(today, i - days + 1); return { day, words: written(log, day) } })
