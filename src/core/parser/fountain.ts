import { parse as parseYaml } from 'yaml'

// Fountain embebido en .md (D1). Tokenizador determinista por líneas (I9): misma entrada -> mismos tokens.
export type TokenType =
  | 'frontmatter'
  | 'heading'
  | 'action'
  | 'character'
  | 'parenthetical'
  | 'dialogue'
  | 'transition'
  | 'centered'
  | 'section'
  | 'synopsis'
  | 'note'
  | 'blank'

export type Token = { type: TokenType; line: number; text: string }

export type Frontmatter = Record<string, unknown>

export type ParsedDoc = { frontmatter: Frontmatter; frontmatterEnd: number; tokens: Token[] }

const HEADING = /^(INT|EXT|EST|INT\.?\/EXT|I\/E)[.\s]/i
const TRANSITION = /^[A-Z0-9 .'-]+TO:$/
const CHARACTER = /^[A-Z0-9 .'-]+(\s*\(.*\))?\s*\^?$/

function splitFrontmatter(lines: string[]): { fm: Frontmatter; end: number } {
  if (lines[0]?.trim() !== '---') return { fm: {}, end: 0 }
  const close = lines.findIndex((l, i) => i > 0 && l.trim() === '---')
  if (close < 0) return { fm: {}, end: 0 }
  let fm: Frontmatter = {}
  try {
    fm = (parseYaml(lines.slice(1, close).join('\n')) as Frontmatter) ?? {}
  } catch {
    fm = {}
  }
  return { fm, end: close + 1 }
}

export function parseFountain(text: string, noteOpen = '%%', noteClose = '%%'): ParsedDoc {
  const lines = text.split('\n')
  const { fm, end } = splitFrontmatter(lines)
  const tokens: Token[] = []
  for (let i = 0; i < end; i++) tokens.push({ type: 'frontmatter', line: i, text: lines[i] ?? '' })

  let inDialogue = false
  for (let i = end; i < lines.length; i++) {
    const raw = lines[i] ?? ''
    const t = raw.trim()
    const prevBlank = i === end || (lines[i - 1] ?? '').trim() === ''
    const nextNonBlank = (lines[i + 1] ?? '').trim() !== ''
    let type: TokenType

    if (t === '') {
      type = 'blank'
      inDialogue = false
    } else if (t.startsWith(noteOpen) && t.endsWith(noteClose)) type = 'note'
    else if (t.startsWith('#')) type = 'section'
    else if (t.startsWith('=')) type = 'synopsis'
    else if (t.startsWith('>') && t.endsWith('<')) type = 'centered'
    else if (t.startsWith('!')) type = 'action'
    else if (t.startsWith('.') && !t.startsWith('..')) type = 'heading'
    else if (t.startsWith('>') || TRANSITION.test(t)) type = 'transition'
    else if (HEADING.test(t)) type = 'heading'
    else if (t.startsWith('@') || (prevBlank && nextNonBlank && CHARACTER.test(t) && t !== t.toLowerCase())) {
      type = 'character'
      inDialogue = true
    } else if (inDialogue && t.startsWith('(') && t.endsWith(')')) type = 'parenthetical'
    else if (inDialogue) type = 'dialogue'
    else type = 'action'

    if (type !== 'blank' && type !== 'dialogue' && type !== 'parenthetical' && type !== 'character') inDialogue = false
    tokens.push({ type, line: i, text: raw })
  }
  return { frontmatter: fm, frontmatterEnd: end, tokens }
}

// Nombre de personaje limpio: "@RICK (V.O.) ^" -> "RICK"
export function characterName(text: string): string {
  return text
    .trim()
    .replace(/^@/, '')
    .replace(/\s*\(.*\)\s*/g, ' ')
    .replace(/\^$/, '')
    .trim()
    .toUpperCase()
}

// Extrae enlaces de entidad según el mapa de tags (default [[ ]]).
export function extractLinks(text: string, open = '[[', close = ']]'): string[] {
  const out: string[] = []
  let i = 0
  for (;;) {
    const a = text.indexOf(open, i)
    if (a < 0) break
    const b = text.indexOf(close, a + open.length)
    if (b < 0) break
    const inner = text.slice(a + open.length, b)
    const name = (inner.split('|')[0] ?? '').split('#')[0]?.trim()
    if (name) out.push(name)
    i = b + close.length
  }
  return out
}
