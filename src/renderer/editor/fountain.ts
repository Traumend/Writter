import { RangeSetBuilder, StateEffect, StateField, type Extension } from '@codemirror/state'
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view'
import { extractLinks, parseFountain } from '../../core/parser/fountain'

// Formateo en vivo (AC-1): decoraciones de línea por tipo de token. El .md en disco no cambia.
// ponytail: re-parseo completo por cambio (lineal, guiones de cientos de páginas tardan ms); incremental por bloque si se nota.
export function fountainDecorations(note: [string, string], link: [string, string]): Extension {
  const compute = (doc: string): DecorationSet => {
    const b = new RangeSetBuilder<Decoration>()
    const { tokens } = parseFountain(doc, note[0], note[1])
    let pos = 0
    for (const t of tokens) {
      const len = t.text.length
      if (t.type !== 'blank') b.add(pos, pos, Decoration.line({ class: `fx-${t.type}` }))
      if (t.type !== 'frontmatter' && t.text.includes(link[0])) {
        let i = 0
        for (const name of extractLinks(t.text, link[0], link[1])) {
          const a = t.text.indexOf(link[0], i)
          const e = t.text.indexOf(link[1], a) + link[1].length
          if (a >= 0 && e > a) b.add(pos + a, pos + e, Decoration.mark({ class: 'fx-link', attributes: { 'data-link': name } }))
          i = e
        }
      }
      pos += len + 1
    }
    return b.finish()
  }
  const field = StateField.define<DecorationSet>({
    create: (s) => compute(s.doc.toString()),
    update: (v, tr) => (tr.docChanged ? compute(tr.newDoc.toString()) : v),
    provide: (f) => EditorView.decorations.from(f)
  })
  return [field, theme]
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
    '.cm-gutters': { display: 'none' },
    '.cm-activeLine': { backgroundColor: 'transparent' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: '#2b4a80 !important' },
    '.fx-frontmatter': { color: 'var(--dim)', fontSize: '11px', fontFamily: 'system-ui, sans-serif' },
    '.fx-heading': { fontWeight: 'bold', textTransform: 'uppercase', marginTop: '1.2em' },
    '.fx-character': { paddingLeft: '20ch', textTransform: 'uppercase', marginTop: '0.8em' },
    '.fx-parenthetical': { paddingLeft: '15ch', color: 'var(--dim)' },
    '.fx-dialogue': { paddingLeft: '10ch', paddingRight: '10ch' },
    '.fx-transition': { textAlign: 'right', textTransform: 'uppercase' },
    '.fx-centered': { textAlign: 'center' },
    '.fx-section': { color: 'var(--accent)', fontWeight: 'bold' },
    '.fx-synopsis': { color: 'var(--dim)', fontStyle: 'italic' },
    '.fx-note': { color: '#c9a227', fontStyle: 'italic', opacity: '0.85' },
    '.fx-link': { color: 'var(--accent)', textDecoration: 'underline dotted', cursor: 'pointer' },
    '.fx-landing': { backgroundColor: 'rgba(79,140,255,0.12)', borderLeft: '2px solid var(--accent)' }
  },
  { dark: true }
)
