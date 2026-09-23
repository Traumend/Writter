// Importación de guiones en PDF (ScriptWriterX §18/§48): del texto con geometría que extrae PDF.js
// a Fountain, usando los márgenes reales del documento. Puro y testeable: la extracción vive en main.

export type PdfItem = { str: string; x: number; y: number; page: number; w?: number } // w = ancho del fragmento
export type PdfLine = { text: string; x: number; y: number; page: number }

// Artefactos de paginación que no son guion: números de página, CONTINUED/MORE, fechas sueltas,
// marcas de agua y filas de símbolos.
export function isJunk(line: string): boolean {
  const t = line.trim()
  if (!t) return true
  if (/^\(?\d{1,3}\.?\)?$/.test(t)) return true
  if (/^(CONTINUED|CONTINUADO|CONTINÚA|CONTINUA|MORE|MÁS|SIGUE)[.:)\s]*$/i.test(t.replace(/[()]/g, ''))) return true
  if (/^\(?(CONT'?D|CONTD)\)?$/i.test(t)) return true
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(t)) return true
  if (/^[^\w\sÁÉÍÓÚÜÑáéíóúüñ]{3,}$/.test(t)) return true
  if (/^(página|page)\s+\d+/i.test(t)) return true
  return false
}

// Junta los fragmentos en líneas por página y coordenada Y (con tolerancia), en orden de lectura.
export function toLines(items: PdfItem[], tolerance = 2): PdfLine[] {
  const byPage = new Map<number, PdfItem[]>()
  for (const it of items) byPage.set(it.page, [...(byPage.get(it.page) ?? []), it])
  const out: PdfLine[] = []
  for (const page of [...byPage.keys()].sort((a, b) => a - b)) {
    const rows: PdfItem[][] = []
    for (const it of byPage.get(page)!.slice().sort((a, b) => b.y - a.y || a.x - b.x)) {
      const row = rows.find((r) => Math.abs((r[0]?.y ?? 0) - it.y) <= tolerance)
      if (row) row.push(it)
      else rows.push([it])
    }
    for (const row of rows) {
      const sorted = row.slice().sort((a, b) => a.x - b.x)
      // PDF.js parte la línea en fragmentos: si entre uno y otro hay hueco, ahí iba un espacio.
      const text = sorted.reduce((acc, it, i) => {
        const prev = sorted[i - 1]
        const gap = prev ? it.x - (prev.x + (prev.w ?? 0)) : 0
        const needsSpace = !!prev && gap > 0.8 && !/\s$/.test(acc) && !/^\s/.test(it.str)
        return acc + (needsSpace ? ' ' : '') + it.str
      }, '').replace(/\s+/g, ' ').trim()
      if (text) out.push({ text, x: sorted[0]!.x, y: sorted[0]!.y, page })
    }
  }
  return out
}

const HEADING = /^(INT|EXT|EST|INT\.?\/EXT|I\/E)[.\s]/i
const TRANSITION = /^[A-ZÁÉÍÓÚÜÑ0-9 .'-]+(TO|A):$/

// Reconstruye el guion: clasifica cada línea por su margen izquierdo y su forma, y lo escribe en Fountain.
export function pdfToFountain(items: PdfItem[], pageWidth = 612): string {
  const lines = toLines(items).filter((l) => !isJunk(l.text))
  if (!lines.length) return ''
  // Margen de acción = el x más frecuente (redondeado); los cues y diálogos van más a la derecha.
  const counts = new Map<number, number>()
  for (const l of lines) { const k = Math.round(l.x / 5) * 5; counts.set(k, (counts.get(k) ?? 0) + 1) }
  const left = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0
  const rel = (x: number) => (x - left) / pageWidth

  const out: string[] = []
  type Kind = 'heading' | 'action' | 'character' | 'dialogue' | 'parenthetical' | 'transition' | ''
  const state: { prev: Kind } = { prev: '' } // objeto para que el análisis de flujo no lo estreche a ''
  const push = (type: Kind, text: string, glued = false) => {
    if (out.length && !glued) out.push('')
    out.push(text)
    state.prev = type
  }
  for (const l of lines) {
    const t = l.text
    const upper = t === t.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(t)
    const r = rel(l.x)
    if (HEADING.test(t)) { push('heading', t.toUpperCase()); continue }
    if (/^\(.*\)$/.test(t) && (state.prev === 'character' || state.prev === 'dialogue')) { push('parenthetical', t, true); continue }
    if (TRANSITION.test(t.toUpperCase()) || (upper && r > 0.45 && t.length < 30)) { push('transition', t.toUpperCase()); continue }
    // Cue de personaje: en mayúsculas y claramente indentado respecto a la acción.
    if (upper && r > 0.22 && t.length <= 40 && !/[.!?]$/.test(t)) { push('character', t); continue }
    // Diálogo: indentado y pegado a su personaje o a la acotación.
    if (r > 0.08 && (state.prev === 'character' || state.prev === 'parenthetical' || state.prev === 'dialogue')) { push('dialogue', t, true); continue }
    push('action', t, state.prev === 'action')
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}
