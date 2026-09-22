// Geometría pura del Beat Timeline (sin React): empaquetado de intervalos en subfilas y rango del acto nuevo.
export type ActRange = { from: number; to: number }

// Empaquetado de intervalos en subfilas: cada elemento va a la primera fila cuyo último fin no lo pisa.
export function pack<T>(items: { a: number; b: number; it: T }[], gap = 0): { it: T; row: number; rows: number }[] {
  const ends: number[] = []
  const placed = [...items].sort((p, q) => p.a - q.a).map(({ a, b, it }) => {
    let row = ends.findIndex((e) => e + gap <= a)
    if (row < 0) { row = ends.length; ends.push(b) } else ends[row] = b
    return { it, row }
  })
  return placed.map((o) => ({ ...o, rows: Math.max(1, ends.length) }))
}
// Rango libre para un acto nuevo: tras el último; si no queda hueco, parte el último por la mitad.
export function nextActRange<A extends ActRange>(acts: A[], n: number): { acts: A[]; from: number; to: number } {
  const last = acts.reduce((m, a) => Math.max(m, a.to), -1)
  if (last < n - 1) return { acts, from: last + 1, to: n - 1 }
  const prev = acts[acts.length - 1]
  if (prev && prev.to > prev.from) { const mid = Math.floor((prev.from + prev.to) / 2); return { acts: acts.map((a, i) => (i === acts.length - 1 ? { ...a, to: mid } : a)), from: mid + 1, to: prev.to } }
  return { acts, from: Math.max(0, n - 1), to: Math.max(0, n - 1) }
}
