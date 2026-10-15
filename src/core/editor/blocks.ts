// Teclado de guion (paridad con ScriptWriterX §16): Enter inteligente y Tab que cicla el tipo de bloque.
// Puro y determinista: la vista solo aplica el texto que devuelven estas funciones.

export type Block = 'heading' | 'action' | 'character' | 'parenthetical' | 'dialogue' | 'transition' | 'section' | 'blank'

const HEADING = /^(INT|EXT|EST|INT\.?\/EXT|I\/E)[.\s]/i
// Transición: cualquier línea en mayúsculas terminada en ':' (CUT TO:, CORTE A:, FUNDIDO A NEGRO:).
const TRANSITION = /^[A-ZÁÉÍÓÚÜÑ0-9 .'-]+:$/
const CUE = /^[A-Z0-9 .'-]+(\s*\(.*\))?\s*\^?$/

// Tipo de una línea, con el tipo de la anterior como contexto (diálogo = texto pegado a un personaje).
export function lineType(line: string, prev: Block = 'blank'): Block {
  const t = line.trim()
  if (!t) return 'blank'
  if (t.startsWith('#')) return 'section'
  if (t.startsWith('.') && !t.startsWith('..')) return 'heading'
  if (t.startsWith('@')) return 'character'
  if (t.startsWith('>')) return 'transition'
  if (t.startsWith('!')) return 'action'
  if (/^\(.*\)$/.test(t)) return 'parenthetical'
  if (HEADING.test(t)) return 'heading'
  if (TRANSITION.test(t)) return 'transition'
  if (prev === 'character' || prev === 'parenthetical' || prev === 'dialogue') return 'dialogue'
  if (CUE.test(t) && t === t.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(t)) return 'character'
  return 'action'
}

// Enter inteligente: cuántos saltos hacen falta para que el siguiente bloque sea el esperado en Fountain.
// Personaje -> diálogo y acotación -> diálogo van pegados; el resto abre bloque nuevo con línea en blanco.
export function smartEnter(cur: Block): string {
  return cur === 'character' || cur === 'parenthetical' || cur === 'dialogue' ? '\n' : '\n\n'
}

// Ciclo de Tab: acción -> encabezado -> personaje -> acotación -> transición -> acción.
// (Diálogo no entra: en Fountain es el texto que sigue a un personaje, no lleva marca propia.)
export const CYCLE: Block[] = ['action', 'heading', 'character', 'parenthetical', 'transition']

const bare = (line: string) => line.trim().replace(/^(\.|@|!|>\s*|#+\s*)/, '').replace(/^\((.*)\)$/, '$1').trim()

// Reescribe la línea como el tipo indicado (marca de Fountain incluida).
export function asBlock(line: string, type: Block): string {
  const indent = /^\s*/.exec(line)?.[0] ?? ''
  const text = bare(line)
  switch (type) {
    case 'heading': return indent + (HEADING.test(text) ? text.toUpperCase() : `.${text.toUpperCase()}`)
    case 'character': return indent + (CUE.test(text.toUpperCase()) ? text.toUpperCase() : `@${text}`)
    case 'parenthetical': return `${indent}(${text})`
    case 'transition': return indent + (TRANSITION.test(text.toUpperCase()) ? text.toUpperCase() : `> ${text.toUpperCase()}`)
    case 'section': return `${indent}# ${text}`
    default: return indent + text
  }
}

// Siguiente tipo del ciclo para la línea actual (Shift+Tab retrocede).
export function cycleBlock(line: string, prev: Block = 'blank', dir: 1 | -1 = 1): { text: string; type: Block } {
  const cur = lineType(line, prev)
  const i = CYCLE.indexOf(cur === 'dialogue' ? 'action' : cur)
  const next = CYCLE[(((i < 0 ? 0 : i) + dir) + CYCLE.length) % CYCLE.length]!
  return { text: asBlock(line, next), type: next }
}
