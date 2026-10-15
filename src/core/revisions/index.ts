// Revisiones por colores (norma de industria; ScriptWriterX §15.2): cada ronda de cambios se emite en un color,
// la numeración queda bloqueada (las escenas nuevas reciben sufijo 5A) y las borradas pasan a OMITIDAS.
// Puro: la instantánea es un mapa encabezado -> hash del texto de la escena.

export type RevisionScope = 'proyecto' | 'episodio'
export type Revision = {
  id: string
  numero: number
  color: string
  fecha: string
  motivo: string
  alcance: RevisionScope
  script?: string // ruta del guion cuando el alcance es episodio
  base: Record<string, string> // encabezado -> hash del contenido al emitir la revisión
}

// Orden estándar de páginas de colores.
export const REVISION_COLORS = ['White Draft', 'Blue', 'Pink', 'Yellow', 'Green', 'Goldenrod', 'Buff', 'Salmon', 'Cherry', 'Tan', '2nd Blue', '2nd Pink', '2nd Yellow', '2nd Green']
export const COLOR_HEX: Record<string, string> = {
  'White Draft': '#e8e8e8', Blue: '#7fb2ff', Pink: '#ff9ec4', Yellow: '#ffe066', Green: '#7fd6a0', Goldenrod: '#dbb14b',
  Buff: '#e8d4a0', Salmon: '#ff9a7f', Cherry: '#e8506b', Tan: '#d2b48c', '2nd Blue': '#5b93e6', '2nd Pink': '#e67aa8', '2nd Yellow': '#e6c93d', '2nd Green': '#5bb887'
}
export const colorOf = (c: string): string => COLOR_HEX[c] ?? '#8b91a0'
export const nextColor = (revs: Revision[]): string => REVISION_COLORS[Math.min(revs.length, REVISION_COLORS.length - 1)]!

// Hash estable y barato (djb2) del texto de cada escena: solo sirve para comparar, no es criptográfico.
export function hashText(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h.toString(36)
}

export const sceneHashes = (scenes: { heading: string; startLine: number; endLine: number }[], text: string): Record<string, string> => {
  const lines = text.split('\n')
  const out: Record<string, string> = {}
  for (const s of scenes) out[s.heading] = hashText(lines.slice(s.startLine, s.endLine).join('\n').trim())
  return out
}

export type Changes = { modified: string[]; added: string[]; removed: string[] }

// Qué cambió desde la revisión: modificadas (mismo encabezado, otro contenido), nuevas y desaparecidas.
export function changes(base: Record<string, string>, now: Record<string, string>): Changes {
  const modified: string[] = []
  const added: string[] = []
  for (const [heading, hash] of Object.entries(now)) {
    if (!(heading in base)) added.push(heading)
    else if (base[heading] !== hash) modified.push(heading)
  }
  const removed = Object.keys(base).filter((h) => !(h in now))
  return { modified, added, removed }
}

// Número de escena nueva con numeración bloqueada: 5 -> 5A, 5A -> 5B, 5B ocupado -> 5C.
export function nextNumber(prev: string | undefined, taken: string[]): string {
  if (!prev) return '1'
  const m = /^([A-Za-z]?\d+)([A-Za-z]*)$/.exec(prev.trim())
  if (!m) return prev + 'A'
  const stem = m[1]!
  const used = new Set(taken.map((x) => x.trim().toUpperCase()))
  for (let i = 0; i < 26 * 2; i++) {
    const suffix = i < 26 ? String.fromCharCode(65 + i) : 'A' + String.fromCharCode(65 + (i - 26))
    const candidate = stem + suffix
    if (!used.has(candidate.toUpperCase())) return candidate
  }
  return stem + 'Z'
}

// Revisión activa para un guion: la última cuyo alcance lo cubre.
export function activeFor(revs: Revision[], script: string): Revision | undefined {
  return [...revs].sort((a, b) => b.numero - a.numero).find((r) => r.alcance === 'proyecto' || r.script === script)
}
