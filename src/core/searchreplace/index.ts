import { parseFountain, type TokenType } from '../parser/fountain'

// Buscar y reemplazar global (Nivel 1): sobre los guiones del vault, filtrando por tipo de bloque.
// Puro y testeable; el renderer aplica escribiendo cada archivo cambiado (con snapshot).
export type SROptions = {
  query: string
  replace: string
  caseSensitive: boolean
  wholeWord: boolean
  regex: boolean
  blockTypes: TokenType[] | null // null = todos los bloques (menos frontmatter/blank)
}
export type SRResult = { path: string; count: number; content: string; samples: string[] }

const EXCLUDE: TokenType[] = ['frontmatter', 'blank']

function buildRegex(o: SROptions): RegExp {
  let src = o.regex ? o.query : o.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (o.wholeWord) src = `\\b(?:${src})\\b`
  return new RegExp(src, 'g' + (o.caseSensitive ? '' : 'i'))
}

export function searchReplace(docs: { path: string; content: string }[], scriptPaths: Set<string>, o: SROptions): SRResult[] {
  if (!o.query) return []
  const allow = o.blockTypes ? new Set(o.blockTypes) : null
  const re = buildRegex(o)
  const out: SRResult[] = []
  for (const d of docs) {
    if (!scriptPaths.has(d.path)) continue
    const lineType = new Map<number, TokenType>()
    for (const t of parseFountain(d.content).tokens) lineType.set(t.line, t.type)
    const lines = d.content.split('\n')
    let count = 0
    const samples: string[] = []
    const next = lines.map((line, i) => {
      const type = lineType.get(i) ?? 'action'
      if (EXCLUDE.includes(type) || (allow && !allow.has(type))) return line
      re.lastIndex = 0
      const matches = line.match(re)
      if (!matches) return line
      count += matches.length
      if (samples.length < 5) samples.push(line.trim().slice(0, 80))
      return line.replace(re, o.replace)
    })
    if (count > 0) out.push({ path: d.path, count, content: next.join('\n'), samples })
  }
  return out
}
