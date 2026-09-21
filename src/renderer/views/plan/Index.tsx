import { useMemo, useState } from 'react'
import { readFrontmatter } from '../../../core/frontmatter'
import { t } from '../../i18n'
import { useStore } from '../../store'
import { refLabel, useCards, usePlanning, useScripts } from './data'
import { useOpenScene } from './shared'

type Cat = 'scenes' | 'characters' | 'locations' | 'props' | 'questions' | 'plants' | 'ideas' | 'notes'
type Row = { id: string; cells: (string | number)[]; open?: () => void }

// Index: navegador tabular de toda la información del proyecto (una historia, muchas vistas).
export function Index() {
  const scripts = useScripts()
  const cards = useCards()
  const { planning } = usePlanning()
  const { files, docs, openFile, setTab } = useStore()
  const openScene = useOpenScene()
  const [cat, setCat] = useState<Cat>('scenes')
  const [q, setQ] = useState('')
  const [sortCol, setSortCol] = useState(0)
  const [asc, setAsc] = useState(true)

  const open = (path: string) => () => { void openFile(path); setTab('desk') }
  const { cols, rows } = useMemo((): { cols: string[]; rows: Row[] } => {
    switch (cat) {
      case 'scenes': return { cols: ['#', 'Escena', 'Episodio', 'Estado', 'POV', 'Track', 'Personajes', 'Palabras', 'Min'], rows: scripts.flatMap((s) => s.scenes.map((sc, i) => { const m = s.sceneMeta[sc.heading] ?? {}; return { id: `${s.path}#${i}`, cells: [i + 1, sc.heading, s.name, m.status ?? '', m.pov ?? '', planning.tracks.find((tr) => tr.id === m.track)?.name ?? '', sc.characters.join(', '), sc.wordCount, Number((s.minutes[i] ?? 0).toFixed(1))], open: () => openScene(scripts, { script: s.path, heading: sc.heading }) } })) }
      case 'characters': return { cols: ['Nombre', 'Grupo', 'Actor', 'Escenas', 'Alias', 'Palabras'], rows: cards.filter((c) => c.kind === 'character').map((c) => ({ id: c.path, cells: [c.name, c.group, c.actor, c.appearances.length, c.aliases.join(', '), c.words], open: open(c.path) })) }
      case 'locations': return { cols: ['Nombre', 'Escenas', 'Alias'], rows: cards.filter((c) => c.kind === 'location').map((c) => ({ id: c.path, cells: [c.name, c.appearances.length, c.aliases.join(', ')], open: open(c.path) })) }
      case 'props': return { cols: ['Nombre', 'Escenas', 'Alias'], rows: cards.filter((c) => c.kind === 'prop').map((c) => ({ id: c.path, cells: [c.name, c.appearances.length, c.aliases.join(', ')], open: open(c.path) })) }
      case 'questions': return { cols: ['Pregunta', 'Estado', 'Importancia', 'Se plantea', 'Se resuelve', 'Personajes'], rows: planning.questions.map((x) => ({ id: x.id, cells: [x.text, x.status, x.importance, refLabel(x.introduced, scripts), refLabel(x.resolved, scripts), x.characters.join(', ')], open: () => openScene(scripts, x.introduced) })) }
      case 'plants': return { cols: ['Plant', 'Tipo', 'Se planta', 'Payoffs', 'Personajes'], rows: planning.plants.map((x) => ({ id: x.id, cells: [x.title, x.type, refLabel(x.plant, scripts), x.payoffs.map((p) => refLabel(p, scripts)).join(', '), x.characters.join(', ')], open: () => openScene(scripts, x.plant) })) }
      case 'ideas': return { cols: ['Idea', 'Sinopsis', 'Personajes', 'Track'], rows: planning.ideas.map((x) => ({ id: x.id, cells: [x.title, x.summary, x.characters.join(', '), planning.tracks.find((tr) => tr.id === x.track)?.name ?? ''] })) }
      case 'notes': return { cols: ['Título', 'Ruta', 'Palabras'], rows: files.filter((f) => f.kind === 'knowledge').map((f) => { const d = docs.find((x) => x.path === f.path); const fm = d ? readFrontmatter(d.content) : null; return { id: f.path, cells: [String(fm?.data['title'] ?? f.name), f.path, fm ? fm.body.split(/\s+/).filter(Boolean).length : 0], open: open(f.path) } }) }
    }
  }, [cat, scripts, cards, planning, files, docs])

  const ql = q.toLowerCase()
  const list = rows.filter((r) => !ql || r.cells.some((c) => String(c).toLowerCase().includes(ql))).sort((a, b) => { const x = a.cells[sortCol] ?? '', y = b.cells[sortCol] ?? ''; const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y)); return asc ? c : -c })
  const csv = () => { const esc = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`; void window.api.exportText([cols.map(esc).join(','), ...list.map((r) => r.cells.map(esc).join(','))].join('\n'), `index-${cat}.csv`) }
  const CATS: [Cat, string][] = [['scenes', 'Escenas'], ['characters', 'Personajes'], ['locations', 'Locaciones'], ['props', 'Ítems'], ['questions', 'Preguntas'], ['plants', 'Plants'], ['ideas', 'Ideas'], ['notes', 'Notas']]

  return (
    <main className="page scroll">
      <div className="toolbar wrap">
        {CATS.map(([c, l]) => <button key={c} className={cat === c ? 'mini on' : 'mini ghost'} onClick={() => { setCat(c); setSortCol(0) }}>{t(l)}</button>)}
        <input placeholder={t('Buscar…')} value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="grow" />
        <span className="muted tiny">{list.length} {t('filas')}</span>
        <button className="ghost mini" onClick={csv}>CSV</button>
      </div>
      <table className="table">
        <thead><tr>{cols.map((c, i) => <th key={c} className="link" onClick={() => { if (sortCol === i) setAsc(!asc); else { setSortCol(i); setAsc(true) } }}>{t(c)}{sortCol === i ? (asc ? ' ▲' : ' ▼') : ''}</th>)}</tr></thead>
        <tbody>{list.map((r) => <tr key={r.id} className={r.open ? 'link' : ''} onClick={r.open}>{r.cells.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody>
      </table>
    </main>
  )
}
