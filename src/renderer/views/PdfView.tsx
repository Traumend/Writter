import { useEffect, useRef, useState } from 'react'
import { lineType, type Block } from '../../core/editor/blocks'
import { t } from '../i18n'
import { useStore } from '../store'
import { useRevisionMarks } from './Revisions'

// Visor paginado (ScriptWriterX §23): muestra el guion tal y como se va a imprimir, con los quiebres
// de página reales del motor de paginación, y sincroniza en los dos sentidos con el editor.
const CLASS: Record<Block, string> = { heading: 'pv-heading', action: 'pv-action', character: 'pv-character', dialogue: 'pv-dialogue', parenthetical: 'pv-paren', transition: 'pv-transition', section: 'pv-section', blank: 'pv-blank' }

export function PdfView() {
  const { text, projection, pagination, cursorLine, setCursor, frontmatter } = useStore()
  const marks = useRevisionMarks()
  const [zoom, setZoom] = useState(1)
  const box = useRef<HTMLDivElement>(null)
  const lines = text.split('\n')
  // El frontmatter YAML no se imprime: se salta el bloque inicial --- … ---
  const fmEnd = lines[0]?.trim() === '---' ? lines.findIndex((l, i) => i > 0 && l.trim() === '---') + 1 : 0
  const pages = Math.max(1, pagination.pages)
  const starts = pagination.pageStarts.length ? pagination.pageStarts : [0]
  const current = pagination.lineToPage[cursorLine] ?? 1

  // Ir a la página del cursor al abrir el visor y cuando cambia de página.
  useEffect(() => { box.current?.querySelector(`[data-page="${current}"]`)?.scrollIntoView({ block: 'start' }) }, [current])

  const goPage = (p: number) => box.current?.querySelector(`[data-page="${Math.min(pages, Math.max(1, p))}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  const headingOf = (line: number) => projection.scenes.find((sc) => line >= sc.startLine && line < sc.endLine)?.heading ?? ''

  return (
    <div className="pdfview">
      <div className="toolbar">
        <button className="mini ghost" onClick={() => goPage(current - 1)} title={t('Página anterior')}>◀</button>
        <span className="muted tiny">{t('pág')} {current} {t('de')} {pages}</span>
        <button className="mini ghost" onClick={() => goPage(current + 1)} title={t('Página siguiente')}>▶</button>
        <span className="sep" />
        <button className="mini ghost" onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))} title={t('Alejar')}>−</button>
        <span className="muted tiny">{Math.round(zoom * 100)}%</span>
        <button className="mini ghost" onClick={() => setZoom((z) => Math.min(1.6, z + 0.1))} title={t('Acercar')}>+</button>
        <span className="grow" />
        <span className="muted tiny ell">{String(frontmatter['title'] ?? '')}</span>
      </div>
      <div className="pdfpages scroll" ref={box}>
        {Array.from({ length: pages }, (_, p) => {
          const from = starts[p] ?? 0
          const to = starts[p + 1] ?? lines.length
          let prev: Block = 'blank'
          return (
            <div key={p} className="pdfpage" data-page={p + 1} style={{ zoom }} onDoubleClick={() => setCursor(from, null)} title={t('Doble clic: llevar el cursor a esta página')}>
              <div className="pv-num">{p + 1}.</div>
              {lines.slice(Math.max(from, p === 0 ? fmEnd : 0), to).map((ln, i) => {
                const type = lineType(ln, prev)
                prev = type
                const lineNo = Math.max(from, p === 0 ? fmEnd : 0) + i
                const changed = marks && type === 'heading' && (marks.modified.has(headingOf(lineNo)) || marks.added.has(headingOf(lineNo)))
                // La marca de revisión va como barra lateral: se ve con cualquier color de página.
                const mark = changed ? { borderLeft: `3px solid ${marks!.color}`, paddingLeft: 8, marginLeft: -11 } : undefined
                return <div key={i} className={CLASS[type]} style={mark}>{ln.replace(/^(\.|@|!|>\s*)/, '') || '\u00a0'}</div>
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
