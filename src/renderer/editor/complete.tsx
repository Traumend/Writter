import { autocompletion, type Completion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete'
import type { Extension } from '@codemirror/state'
import { lineType, type Block } from '../../core/editor/blocks'
import { suggestAt, TIMES, TRANSITIONS, type SuggestKind } from '../../core/editor/complete'
import { readFrontmatter } from '../../core/frontmatter'
import type { Doc, FileEntry } from '../../core/types/ipc'
import { useStore } from '../store'

// Predicciones de escritura: personajes (con alias), lugares, momentos del día y transiciones.
// Los datos salen del vault; la decisión de qué ofrecer, de core/editor/complete.

let cache: { docs: Doc[]; lists: Record<SuggestKind, string[]> } | null = null

function lists(): Record<SuggestKind, string[]> {
  const { files, docs } = useStore.getState()
  if (cache && cache.docs === docs) return cache.lists
  const of = (kind: FileEntry['kind']) => {
    const out = new Set<string>()
    for (const f of files.filter((x) => x.kind === kind)) {
      out.add(f.name.toUpperCase())
      const al = readFrontmatter(docs.find((d) => d.path === f.path)?.content ?? '').data['aliases']
      if (Array.isArray(al)) for (const a of al) out.add(String(a).toUpperCase())
    }
    return [...out]
  }
  const lists: Record<SuggestKind, string[]> = { character: of('character'), location: of('location'), time: TIMES, transition: TRANSITIONS }
  cache = { docs, lists }
  return lists
}

const LABEL: Record<SuggestKind, string> = { character: 'personaje', location: 'lugar', time: 'momento', transition: 'transición' }

export function scriptCompletion(): Extension {
  const source = (ctx: CompletionContext): CompletionResult | null => {
    const line = ctx.state.doc.lineAt(ctx.pos)
    const col = ctx.pos - line.from
    let prev: Block = 'blank'
    for (let n = Math.max(1, line.number - 6); n < line.number; n++) prev = lineType(ctx.state.doc.line(n).text, prev)
    const sg = suggestAt(line.text, col, prev)
    if (!sg) return null
    if (!ctx.explicit && col - sg.from < 1) return null // no molestar en línea vacía salvo que se pida (Ctrl+Espacio)
    const options: Completion[] = lists()[sg.kind].map((label) => ({ label, type: sg.kind === 'character' ? 'variable' : 'text', detail: LABEL[sg.kind] }))
    if (!options.length) return null
    return { from: line.from + sg.from, options, validFor: /^[^\n]*$/ }
  }
  return autocompletion({ override: [source], icons: false, activateOnTyping: true })
}
