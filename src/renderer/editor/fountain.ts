import { RangeSetBuilder, StateEffect, StateField, type Extension } from '@codemirror/state'
import { Decoration, EditorView, gutter, GutterMarker, type DecorationSet } from '@codemirror/view'
import { paginate, type Pagination } from '../../core/paginate'
import { extractLinks, parseFountain, type ParsedDoc, type TokenType } from '../../core/parser/fountain'

// Formateo en vivo (AC-1): decoraciones de línea por tipo de token, marcas de enlace y de entidad,
// saltos de página estimados y gutter con etiquetas de elemento. El .md en disco no cambia.
// ponytail: re-parseo completo por cambio (lineal, ms para guiones largos); incremental por bloque si se nota.
export const setNames = StateEffect.define<string[]>()

type Fx = { doc: ParsedDoc; pag: Pagination; names: string[]; deco: DecorationSet }

const LABEL: Partial<Record<TokenType, string>> = { heading: 'HEADING', action: 'ACTION', character: 'CHARACTER', dialogue: 'DIALOGUE', parenthetical: 'PARENTHETICAL', transition: 'TRANSITION', centered: 'CENTERED', note: 'NOTE' }

class Tag extends GutterMarker {
  constructor(readonly t: string) {
    super()
  }
  override eq(o: Tag) {
    return o.t === this.t
  }
  override toDOM() {
    const s = document.createElement('span')
    s.className = `fx-tag fx-tag-${this.t.toLowerCase()}`
    s.textContent = this.t
    return s
  }
}

export function fountainExtension(note: [string, string], link: [string, string]): Extension {
  const compute = (text: string, names: string[]): Fx => {
    const doc = parseFountain(text, note[0], note[1])
    const pag = paginate(doc.tokens)
    const breaks = new Set(pag.pageStarts)
    const nameRe = names.length ? new RegExp(`\\b(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi') : null
    const b = new RangeSetBuilder<Decoration>()
    let pos = 0
    for (const t of doc.tokens) {
      if (breaks.has(t.line)) b.add(pos, pos, Decoration.line({ class: 'fx-pagebreak', attributes: { 'data-page': String(pag.lineToPage[t.line] ?? '') } }))
      if (t.type !== 'blank') b.add(pos, pos, Decoration.line({ class: `fx-${t.type}` }))
      if (t.type !== 'frontmatter' && t.type !== 'blank') {
        const marks: { a: number; e: number; d: Decoration }[] = []
        if (t.text.includes(link[0])) {
          let i = 0
          for (const name of extractLinks(t.text, link[0], link[1])) {
            const a = t.text.indexOf(link[0], i)
            const e = t.text.indexOf(link[1], a) + link[1].length
            if (a >= 0 && e > a) marks.push({ a, e, d: Decoration.mark({ class: 'fx-link', attributes: { 'data-link': name } }) })
            i = e
          }
        }
        if (nameRe && t.type !== 'character') {
          for (const m of t.text.matchAll(nameRe)) {
            const a = m.index ?? 0
            const e = a + m[0].length
            if (!marks.some((x) => a < x.e && e > x.a)) marks.push({ a, e, d: Decoration.mark({ class: 'fx-entity' }) })
          }
        }
        marks.sort((x, y) => x.a - y.a)
        for (const m of marks) b.add(pos + m.a, pos + m.e, m.d)
      }
      pos += t.text.length + 1
    }
    return { doc, pag, names, deco: b.finish() }
  }

  const field = StateField.define<Fx>({
    create: (s) => compute(s.doc.toString(), []),
    update(v, tr) {
      const eff = tr.effects.find((e) => e.is(setNames))
      if (eff) return compute(tr.newDoc.toString(), eff.value as string[])
      return tr.docChanged ? compute(tr.newDoc.toString(), v.names) : v
    },
    provide: (f) => EditorView.decorations.from(f, (s) => s.deco)
  })

  const tags = gutter({
    class: 'fx-gutter',
    lineMarker(view, line) {
      const fx = view.state.field(field)
      const n = view.state.doc.lineAt(line.from).number - 1
      const t = fx.doc.tokens[n]?.type
      const prev = fx.doc.tokens[n - 1]?.type
      const label = t ? LABEL[t] : undefined
      return label && t !== prev ? new Tag(label) : null
    },
    lineMarkerChange: (u) => u.docChanged || u.transactions.some((t) => t.effects.some((e) => e.is(setNames)))
  })

  return [field, tags, theme]
}

// Landing point (AC-4): resalta el rango [from, to) de líneas de la propuesta de IA.
export const setLanding = StateEffect.define<{ from: number; to: number } | null>()
export const landingField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(v, tr) {
    for (const e of tr.effects) {
      if (e.is(setLanding)) {
        if (!e.value) return Decoration.none
        const b = new RangeSetBuilder<Decoration>()
        for (let l = e.value.from; l < Math.min(e.value.to, tr.newDoc.lines); l++) b.add(tr.newDoc.line(l + 1).from, tr.newDoc.line(l + 1).from, Decoration.line({ class: 'fx-landing' }))
        return b.finish()
      }
    }
    return tr.docChanged ? v.map(tr.changes) : v
  },
  provide: (f) => EditorView.decorations.from(f)
})

const theme = EditorView.theme(
  {
    '&': { height: '100%', fontSize: '13px', backgroundColor: 'var(--bg)', color: 'var(--fg)' },
    '.cm-scroller': { fontFamily: '"Courier Prime", "Courier New", monospace', lineHeight: '1.6', padding: '24px 0' },
    '.cm-content': { maxWidth: '62ch', margin: '0 auto', caretColor: 'var(--fg)' },
    '.cm-gutters': { backgroundColor: 'var(--bg)', border: 'none', color: 'var(--dim)' },
    '.fx-gutter': { width: '96px' },
    '.fx-gutter .cm-gutterElement': { padding: '0 6px', textAlign: 'right' },
    '.cm-activeLine': { backgroundColor: 'transparent' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: 'rgba(255,90,31,0.28) !important' },
    '.fx-frontmatter': { color: 'var(--dim)', fontSize: '11px', fontFamily: 'system-ui, sans-serif' },
    '.fx-heading': { fontWeight: 'bold', textTransform: 'uppercase', paddingTop: '1.2em' },
    '.fx-character': { paddingLeft: '20ch', textTransform: 'uppercase', paddingTop: '0.8em' },
    '.fx-parenthetical': { paddingLeft: '15ch', color: 'var(--dim)' },
    '.fx-dialogue': { paddingLeft: '10ch', paddingRight: '10ch' },
    '.fx-transition': { textAlign: 'right', textTransform: 'uppercase' },
    '.fx-centered': { textAlign: 'center' },
    '.fx-section': { color: 'var(--accent)', fontWeight: 'bold' },
    '.fx-synopsis': { color: 'var(--dim)', fontStyle: 'italic' },
    '.fx-note': { color: '#c9a227', fontStyle: 'italic', opacity: '0.85' },
    '.fx-link': { color: 'var(--accent)', textDecoration: 'underline dotted', cursor: 'pointer' },
    '.fx-entity': { textDecoration: 'underline', textDecorationColor: 'var(--entity)', textDecorationStyle: 'dotted', textUnderlineOffset: '3px' },
    '.fx-landing': { backgroundColor: 'rgba(255,90,31,0.12)', borderLeft: '2px solid var(--accent)' },
    '.fx-pagebreak': { borderTop: '1px dashed var(--line)', paddingTop: '2.2em', position: 'relative' },
    '.fx-pagebreak::before': { content: 'attr(data-page)', position: 'absolute', right: '0', top: '0.4em', fontSize: '10px', color: 'var(--dim)', fontFamily: 'system-ui, sans-serif' }
  },
  { dark: true }
)
