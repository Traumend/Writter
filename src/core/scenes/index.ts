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

// Duplica una escena justo después de la original (ScriptWriterX §11). El encabezado duplicado
// se marca con " (COPIA)" para que no haya dos escenas idénticas en el desglose.
export function duplicateScene(text: string, scenes: Scene[], i: number): string {
  const sc = scenes[i]
  if (!sc) return text
  const lines = text.split('\n')
  const block = lines.slice(sc.startLine, sc.endLine)
  const head = (block[0] ?? '').trim()
  const copy = [head ? `${head} (COPIA)` : head, ...block.slice(1)]
  const out = [...lines.slice(0, sc.endLine)]
  if ((out[out.length - 1] ?? '').trim() !== '') out.push('')
  out.push(...copy, ...lines.slice(sc.endLine))
  return out.join('\n')
}

// Inserta una escena vacía antes o después de la indicada (o al final si no hay ninguna).
export function insertScene(text: string, scenes: Scene[], i: number, where: 'before' | 'after' | 'end', heading: string): string {
  const lines = text.split('\n')
  const sc = scenes[i]
  const at = where === 'end' || !sc ? lines.length : where === 'before' ? sc.startLine : sc.endLine
  const block = ['', heading, '']
  const out = [...lines.slice(0, at), ...block, ...lines.slice(at)]
  return out.join('\n').replace(/\n{3,}/g, '\n\n')
}
