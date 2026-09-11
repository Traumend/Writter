import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { useEffect, useRef } from 'react'
import { useStore } from '../store'
import { fountainDecorations, landingField, setLanding } from './fountain'

export function Editor() {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const path = useStore((s) => s.path)
  const externalSeq = useStore((s) => s.externalSeq)
  const proposal = useStore((s) => s.proposal)
  const vault = useStore((s) => s.vault)

  useEffect(() => {
    if (!host.current || !path) return
    const s = useStore.getState()
    const [no = '%%', nc = '%%'] = (vault?.config.tags.note ?? '%% %%').split(/\s+/)
    const [lo = '[[', lc = ']]'] = (vault?.config.tags.entity_link ?? '[[ ]]').split(/\s+/)
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: s.text,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap, { key: 'Mod-s', run: () => (void useStore.getState().save(), true) }]),
          EditorView.lineWrapping,
          fountainDecorations([no, nc], [lo, lc]),
          landingField,
          EditorView.updateListener.of((u) => {
            if (u.docChanged) useStore.getState().setTextFromEditor(u.state.doc.toString())
            if (u.selectionSet || u.docChanged) {
              const r = u.state.selection.main
              const line = u.state.doc.lineAt(r.head).number - 1
              const sel = r.empty ? null : { from: u.state.doc.lineAt(r.from).number - 1, to: u.state.doc.lineAt(r.to).number }
              useStore.getState().setCursor(line, sel)
            }
          }),
          EditorView.domEventHandlers({
            click(e) {
              const t = (e.target as HTMLElement).closest('.fx-link') as HTMLElement | null
              const name = t?.dataset['link']
              if (!name || !(e.ctrlKey || e.metaKey)) return false
              const f = useStore.getState().files.find((x) => x.name.toLowerCase() === name.toLowerCase())
              if (f) void useStore.getState().openFile(f.path)
              return true
            }
          })
        ]
      })
    })
    view.current = v
    return () => {
      v.destroy()
      view.current = null
    }
    // El editor se recrea al cambiar de archivo; el texto vive en el store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path])

  // Texto cambiado fuera del editor (recarga de disco, aceptar IA, restaurar versión) -> sincroniza sin perder cursor (I9).
  useEffect(() => {
    const v = view.current
    if (!v) return
    const text = useStore.getState().text
    if (v.state.doc.toString() === text) return
    const head = Math.min(v.state.selection.main.head, text.length)
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: text }, selection: { anchor: head } })
  }, [externalSeq])

  useEffect(() => {
    view.current?.dispatch({ effects: setLanding.of(proposal ? { from: proposal.from, to: proposal.to } : null) })
  }, [proposal])

  return <div ref={host} className="editor" />
}
