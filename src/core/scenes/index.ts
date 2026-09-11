import type { Scene } from '../projection'

// Reordenar escenas (A): mueve el bloque de líneas [start, end) de una escena a otra posición.
export function moveScene(text: string, scenes: Scene[], from: number, to: number): string {
  if (from === to || !scenes[from] || to < 0 || to >= scenes.length) return text
  const lines = text.split('\n')
  const blocks = scenes.map((s) => lines.slice(s.startLine, s.endLine))
  const head = lines.slice(0, scenes[0]!.startLine)
  const [moved] = blocks.splice(from, 1)
  blocks.splice(to, 0, moved!)
  // Asegura una línea en blanco entre bloques.
  const out = [...head]
  for (const b of blocks) {
    if (out.length && (out[out.length - 1] ?? '').trim() !== '') out.push('')
    out.push(...b)
  }
  return out.join('\n')
}
