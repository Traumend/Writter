import { XMLParser } from 'fast-xml-parser'
import { parseFountain, type Token } from '../parser/fountain'

// Import/Export (M5, AC-3): estructura preservada, tipografía fina no.

// .fdx (Final Draft XML) -> Fountain en .md
export function fdxToMd(xml: string, title: string): string {
  const doc = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' }).parse(xml) as { FinalDraft?: { Content?: { Paragraph?: unknown } } }
  const paras = doc.FinalDraft?.Content?.Paragraph
  const list = (Array.isArray(paras) ? paras : paras ? [paras] : []) as { Type?: string; Text?: unknown }[]
  const textOf = (t: unknown): string => {
    if (t == null) return ''
    if (typeof t === 'string') return t
    if (Array.isArray(t)) return t.map(textOf).join('')
    if (typeof t === 'object') return textOf((t as { '#text'?: unknown })['#text'])
    return String(t)
  }
  const out: string[] = []
  let prev = ''
  for (const p of list) {
    const text = textOf(p.Text).trim()
    const type = p.Type ?? 'Action'
    if (!text) continue
    const dialogueBlock = type === 'Dialogue' || type === 'Parenthetical'
    if (!(dialogueBlock && (prev === 'Character' || prev === 'Dialogue' || prev === 'Parenthetical'))) out.push('')
    if (type === 'Scene Heading') out.push(text.toUpperCase())
    else if (type === 'Character') out.push(text.toUpperCase())
    else if (type === 'Transition') out.push(text.toUpperCase().endsWith('TO:') ? text.toUpperCase() : `> ${text}`)
    else out.push(text)
    prev = type
  }
  return `---\ntype: script\ntitle: "${title.replace(/"/g, '\\"')}"\nstatus: draft\nlocked: false\n---\n${out.join('\n')}\n`
}

// .md (Fountain embebido) -> .fountain puro: quita frontmatter YAML y notas, conserva el resto.
export function mdToFountain(md: string): string {
  const { tokens } = parseFountain(md)
  return tokens.filter((t) => t.type !== 'frontmatter' && t.type !== 'note').map((t) => t.text).join('\n').replace(/^\n+/, '')
}

// .fountain -> .md: añade frontmatter mínimo.
export function fountainToMd(f: string, title: string): string {
  return `---\ntype: script\ntitle: "${title.replace(/"/g, '\\"')}"\nstatus: draft\nlocked: false\n---\n\n${f.replace(/^\s*title:.*\n(\s+.*\n)*/i, '')}`
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// HTML con formato de industria para imprimir a PDF (Courier 12pt, márgenes estándar).
export function mdToHtml(md: string, title: string): string {
  const { tokens } = parseFountain(md)
  const cls: Record<Token['type'], string> = {
    frontmatter: '', blank: '', heading: 'h', action: 'a', character: 'c', parenthetical: 'p', dialogue: 'd', transition: 't', centered: 'ce', section: '', synopsis: '', note: ''
  }
  const body = tokens
    .filter((t) => cls[t.type])
    .map((t) => `<div class="${cls[t.type]}">${esc(t.text.trim().replace(/^[.@!>]/, '').replace(/<$/, ''))}</div>`)
    .join('\n')
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
@page{size:Letter;margin:1in 1in 1in 1.5in}body{font:12pt "Courier New",Courier,monospace;line-height:1;color:#000}
div{white-space:pre-wrap;margin:0}.h{font-weight:bold;text-transform:uppercase;margin-top:2em}.a{margin-top:1em}
.c{margin:1em 0 0 2.2in;text-transform:uppercase}.p{margin-left:1.6in;width:2in}.d{margin-left:1in;width:3.5in}.t{text-align:right;margin-top:1em}.ce{text-align:center;margin-top:1em}
</style></head><body>${body}</body></html>`
}
