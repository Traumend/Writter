// Predicciones de escritura (ScriptWriterX §10/§16): qué se puede autocompletar en la posición del cursor.
// Puro: decide el tipo de sugerencia y desde qué columna reemplaza; la vista pone los datos del vault.
import type { Block } from './blocks'

export type SuggestKind = 'character' | 'location' | 'time' | 'transition'
export type Suggest = { kind: SuggestKind; from: number } // `from` = columna donde empieza lo que se reemplaza

const HEAD_PREFIX = /^(INT\.?\/EXT|I\/E|INT|EXT|EST)[.\s]+/i
export const TIMES = ['DÍA', 'NOCHE', 'TARDE', 'AMANECER', 'ATARDECER', 'CONTINUO', 'MÁS TARDE', 'MOMENTOS DESPUÉS']
export const TRANSITIONS = ['CORTE A:', 'CORTE DIRECTO A:', 'FUNDIDO A NEGRO:', 'FUNDIDO DESDE NEGRO:', 'DISOLVENCIA A:', 'MATCH CUT A:', 'FIN']

export function suggestAt(line: string, col: number, prev: Block = 'blank'): Suggest | null {
  const head = line.slice(0, col)
  if (/^\s*>/.test(head)) return { kind: 'transition', from: (/^\s*>\s*/.exec(head)?.[0].length ?? 1) }
  const lead = head.length - head.trimStart().length
  const forced = /^\.[^.]/.test(head.trimStart()) || head.trimStart() === '.'
  const m = HEAD_PREFIX.exec(head.trimStart())
  if (m || forced) {
    const indent = lead
    // Momento del día: lo que va tras el último " - " del encabezado.
    const dash = head.lastIndexOf(' - ')
    if (dash >= 0) return { kind: 'time', from: dash + 3 }
    return { kind: 'location', from: indent + (m ? m[0].length : 1) }
  }
  // Personaje: bloque nuevo, texto corto y sin puntuación de frase (los nombres pueden llevar espacios).
  const indent = head.length - head.trimStart().length
  const typed = head.trim()
  if ((prev === 'blank' || prev === 'action' || prev === 'dialogue') && typed.length >= 1 && typed.length <= 40 && !/[.,;:!?()]/.test(typed)) {
    return { kind: 'character', from: indent }
  }
  return null
}
