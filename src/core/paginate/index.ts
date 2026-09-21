import type { Token } from '../parser/fountain'

// Paginación estimada (A): líneas impresas por tipo con anchos de formato de industria, 55 líneas/página.
// ponytail: estimación, no motor de paginación; suficiente para conteo y saltos orientativos.
const WIDTH: Partial<Record<Token['type'], number>> = { action: 61, dialogue: 35, parenthetical: 25, heading: 61, transition: 61, centered: 61 }
const LINES_PER_PAGE = 55

export type Pagination = { pages: number; pageStarts: number[]; lineToPage: number[] }

// Líneas impresas por línea de token (mismo modelo que paginate). Sirve para estimar duración por escena.
export function printedLines(tokens: Token[]): number[] {
  const out: number[] = []
  let prevBlank = true
  for (const t of tokens) {
    let n = 0
    if (t.type === 'frontmatter' || t.type === 'note' || t.type === 'section' || t.type === 'synopsis') n = 0
    else if (t.type === 'blank') n = prevBlank ? 0 : 1
    else n = Math.max(1, Math.ceil(t.text.trim().length / (WIDTH[t.type] ?? 61)))
    prevBlank = t.type === 'blank'
    out[t.line] = n
  }
  return out
}

// Minutos estimados por escena (1 página ≈ 1 minuto; 55 líneas/página).
export function sceneMinutes(tokens: Token[], scenes: { startLine: number; endLine: number }[]): number[] {
  const pl = printedLines(tokens)
  return scenes.map((s) => {
    let sum = 0
    for (let i = s.startLine; i < s.endLine; i++) sum += pl[i] ?? 0
    return sum / LINES_PER_PAGE
  })
}

export function paginate(tokens: Token[]): Pagination {
  const lineToPage: number[] = []
  const pageStarts: number[] = []
  let printed = 0
  let page = 1
  let prevBlank = true
  for (const t of tokens) {
    if (t.type === 'frontmatter' || t.type === 'note' || t.type === 'section' || t.type === 'synopsis') {
      lineToPage[t.line] = page
      continue
    }
    let n = 0
    if (t.type === 'blank') n = prevBlank ? 0 : 1
    else {
      const w = WIDTH[t.type] ?? 61
      n = Math.max(1, Math.ceil(t.text.trim().length / w))
      if (t.type === 'heading' && printed > 0) n += 1
    }
    prevBlank = t.type === 'blank'
    if (printed + n > LINES_PER_PAGE && printed > 0) {
      page++
      printed = 0
      pageStarts.push(t.line)
    }
    printed += n
    lineToPage[t.line] = page
  }
  return { pages: page, pageStarts, lineToPage }
}
