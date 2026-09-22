import { useMemo, useState, type ReactNode } from 'react'
import { readFrontmatter } from '../../../core/frontmatter'
import { SCENE_STATUS, type SceneStatus } from '../../../core/planning'
import { t } from '../../i18n'
import { useStore } from '../../store'
import { BlurInput } from '../../ui'
import { refLabel, useCards, usePlanning, useScripts, useSceneMetaWriter } from './data'
import { useOpenScene } from './shared'

type Cat = 'scenes' | 'characters' | 'locations' | 'props' | 'questions' | 'plants' | 'ideas' | 'notes'
// Una celda es su valor (orden, búsqueda y CSV) y, si es editable, el control que la pinta.
type Cell = string | number | { v: string | number; node: ReactNode }
type Row = { id: string; cells: Cell[]; open?: () => void }
const val = (c: Cell): string | number => (typeof c === 'object' ? c.v : c)

const STATUS_LABEL: Record<SceneStatus, string> = { idea: 'Idea', outline: 'Escaleta', planned: 'Planeada', draft: 'Borrador', revision: 'Necesita revisión', revised: 'Revisada', final: 'Final', cut: 'Cortada' }

// Index: navegador tabular de toda la información del proyecto (una historia, muchas vistas),
// con edición en línea de los campos simples de escena (PRD §71) y filtros (PRD §96).
export function Index() {
  const scripts = useScripts()
  const cards = useCards()
  const { planning } = usePlanning()
  const { files, docs, openFile, setTab } = useStore()
  const openScene = useOpenScene()
  const writeMeta = useSceneMetaWriter()
  const [cat, setCat] = useState<Cat>('scenes')
  const [q, setQ] = useState('')
  const [fTrack, setFTrack] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fChar, setFChar] = useState('')
  const [sortCol, setSortCol] = useState(0)
  const [asc, setAsc] = useState(true)
  const chars = cards.filter((c) => c.kind === 'character').map((c) => c.name)

  const open = (path: string) => () => { void openFile(path); setTab('desk') }
  const { cols, rows } = useMemo((): { cols: string[]; rows: Row[] } => {
    switch (cat) {
      case 'scenes': return {
        cols: ['#', 'Escena', 'Episodio', 'Estado', 'POV', 'Track', 'Etiquetas', 'Personajes', 'Palabras', 'Min'],
        rows: scripts.flatMap((s) => s.scenes.map((sc, i) => {
          const m = s.sceneMeta[sc.heading] ?? {}
          const track = planning.tracks.find((tr) => tr.id === m.track)
          return {
            id: `${s.path}#${i}`,
            cells: [
              i + 1, sc.heading, s.name,
              // Edición en línea: escribe en outline/<guion>.md sin abrir el Planner.
              { v: m.status ? t(STATUS_LABEL[m.status]) : '', node: <select value={m.status ?? ''} onClick={(e) => e.stopPropagation()} onChange={(e) => void writeMeta(s, sc.heading, { status: (e.target.value || undefined) as SceneStatus | undefined })}><option value="">—</option>{SCENE_STATUS.map((st) => <option key={st} value={st}>{t(STATUS_LABEL[st])}</option>)}</select> },
              { v: m.pov ?? '', node: <select value={m.pov ?? ''} onClick={(e) => e.stopPropagation()} onChange={(e) => void writeMeta(s, sc.heading, { pov: e.target.value })}><option value="">—</option>{[...new Set([...sc.characters, ...chars])].map((c) => <option key={c} value={c}>{c}</option>)}</select> },
              { v: track?.name ?? '', node: <select value={m.track ?? ''} onClick={(e) => e.stopPropagation()} onChange={(e) => void writeMeta(s, sc.heading, { track: e.target.value })}><option value="">—</option>{planning.tracks.map((tr) => <option key={tr.id} value={tr.id}>{tr.name}</option>)}</select> },
              // Etiquetas libres por escena (#flashback, #clue…): se guardan en sceneMeta del outline.
              { v: (m.tags ?? []).join(' '), node: <span onClick={(e) => e.stopPropagation()}><BlurInput value={(m.tags ?? []).join(' ')} placeholder={t('etiquetas')} onCommit={(v) => void writeMeta(s, sc.heading, { tags: v.split(/[\s,]+/).map((x) => x.replace(/^#/, '')).filter(Boolean) })} /></span> },
              sc.characters.join(', '), sc.wordCount, Number((s.minutes[i] ?? 0).toFixed(1))
            ],
            open: () => openScene(scripts, { script: s.path, heading: sc.heading })
          }
        })).filter((r) => (!fTrack || val(r.cells[5]!) === fTrack) && (!fStatus || val(r.cells[3]!) === fStatus) && (!fChar || String(val(r.cells[7]!)).includes(fChar)))
      }
      case 'characters': return { cols: ['Nombre', 'Grupo', 'Actor', 'Escenas', 'Alias', 'Palabras'], rows: cards.filter((c) => c.kind === 'character').map((c) => ({ id: c.path, cells: [c.name, c.group, c.actor, c.appearances.length, c.aliases.join(', '), c.words], open: open(c.path) })) }
      case 'locations': return { cols: ['Nombre', 'Escenas', 'Alias'], rows: cards.filter((c) => c.kind === 'location').map((c) => ({ id: c.path, cells: [c.name, c.appearances.length, c.aliases.join(', ')], open: open(c.path) })) }
      case 'props': return { cols: ['Nombre', 'Escenas', 'Alias'], rows: cards.filter((c) => c.kind === 'prop').map((c) => ({ id: c.path, cells: [c.name, c.appearances.length, c.aliases.join(', ')], open: open(c.path) })) }
      case 'questions': return { cols: ['Pregunta', 'Estado', 'Importancia', 'Se plantea', 'Hitos', 'Se resuelve', 'Personajes'], rows: planning.questions.map((x) => ({ id: x.id, cells: [x.text, x.status, x.importance, refLabel(x.introduced, scripts), x.beats.length, refLabel(x.resolved, scripts), x.characters.join(', ')], open: () => openScene(scripts, x.introduced) })) }
      case 'plants': return { cols: ['Plant', 'Tipo', 'Se planta', 'Payoffs', 'Personajes'], rows: planning.plants.map((x) => ({ id: x.id, cells: [x.title, x.type, refLabel(x.plant, scripts), x.payoffs.map((p) => refLabel(p, scripts)).join(', '), x.characters.join(', ')], open: () => openScene(scripts, x.plant) })) }
      case 'ideas': return { cols: ['Idea', 'Sinopsis', 'Personajes', 'Track'], rows: planning.ideas.map((x) => ({ id: x.id, cells: [x.title, x.summary, x.characters.join(', '), planning.tracks.find((tr) => tr.id === x.track)?.name ?? ''] })) }
      case 'notes': return { cols: ['Título', 'Ruta', 'Palabras'], rows: files.filter((f) => f.kind === 'knowledge').map((f) => { const d = docs.find((x) => x.path === f.path); const fm = d ? readFrontmatter(d.content) : null; return { id: f.path, cells: [String(fm?.data['title'] ?? f.name), f.path, fm ? fm.body.split(/\s+/).filter(Boolean).length : 0], open: open(f.path) } }) }
    }
  }, [cat, scripts, cards, planning, files, docs, chars, fTrack, fStatus, fChar])

  const ql = q.toLowerCase()
  const list = rows.filter((r) => !ql || r.cells.some((c) => String(val(c)).toLowerCase().includes(ql))).sort((a, b) => { const x = val(a.cells[sortCol] ?? ''), y = val(b.cells[sortCol] ?? ''); const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y)); return asc ? c : -c })
  const csv = () => { const esc = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`; void window.api.exportText([cols.map(esc).join(','), ...list.map((r) => r.cells.map((c) => esc(val(c))).join(','))].join('\n'), `index-${cat}.csv`) }
  const CATS: [Cat, string][] = [['scenes', 'Escenas'], ['characters', 'Personajes'], ['locations', 'Locaciones'], ['props', 'Ítems'], ['questions', 'Preguntas'], ['plants', 'Plants'], ['ideas', 'Ideas'], ['notes', 'Notas']]

  return (
    <main className="page scroll">
      <div className="toolbar wrap">
        {CATS.map(([c, l]) => <button key={c} className={cat === c ? 'mini on' : 'mini ghost'} onClick={() => { setCat(c); setSortCol(0) }}>{t(l)}</button>)}
        <input placeholder={t('Buscar…')} value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="grow" />
        <span className="muted tiny">{list.length} {t('filas')}</span>
        <button className="mini ghost" onClick={csv}>CSV</button>
      </div>
      {cat === 'scenes' && (
        <div className="toolbar wrap">
          <span className="muted tiny">{t('Filtrar')}</span>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}><option value="">{t('Todos los estados')}</option>{SCENE_STATUS.map((s) => <option key={s} value={t(STATUS_LABEL[s])}>{t(STATUS_LABEL[s])}</option>)}</select>
          <select value={fTrack} onChange={(e) => setFTrack(e.target.value)}><option value="">{t('Todos los tracks')}</option>{planning.tracks.map((tr) => <option key={tr.id} value={tr.name}>{tr.name}</option>)}</select>
          <select value={fChar} onChange={(e) => setFChar(e.target.value)}><option value="">{t('Todos los personajes')}</option>{chars.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          {(fStatus || fTrack || fChar) && <button className="mini ghost" onClick={() => { setFStatus(''); setFTrack(''); setFChar('') }}>{t('Limpiar')}</button>}
        </div>
      )}
      <table className="table">
        <thead><tr>{cols.map((c, i) => <th key={c} className="link" onClick={() => { if (sortCol === i) setAsc(!asc); else { setSortCol(i); setAsc(true) } }}>{t(c)}{sortCol === i ? (asc ? ' ▲' : ' ▼') : ''}</th>)}</tr></thead>
        <tbody>{list.map((r) => <tr key={r.id} className={r.open ? 'link' : ''} onClick={r.open}>{r.cells.map((c, i) => <td key={i}>{typeof c === 'object' ? c.node : c}</td>)}</tr>)}</tbody>
      </table>
      {list.length === 0 && <p className="muted center">{t('Nada que mostrar todavía en esta categoría.')}</p>}
    </main>
  )
}
