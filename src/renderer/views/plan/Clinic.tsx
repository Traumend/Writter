import { useMemo, useState } from 'react'
import { clinic, type Area, type Severity } from '../../../core/clinic'
import { readFrontmatter } from '../../../core/frontmatter'
import { byId } from '../../../core/library'
import { t } from '../../i18n'
import { useStore } from '../../store'
import { Icon } from '../../ui'
import { useCards, usePlanning, useScripts } from './data'
import { SEV_COLOR, SEV_LABEL, useOpenScene } from './shared'

const AREA_LABEL: Record<Area, string> = { structure: 'Estructura', characters: 'Personajes', questions: 'Preguntas', plants: 'Plant & Payoff', tracks: 'Tracks', pacing: 'Ritmo', ideas: 'Ideas' }

// Clinic: diagnóstico narrativo local. Muestra señales, no veredictos; cada hallazgo enlaza a escenas y técnicas.
export function Clinic() {
  const scripts = useScripts()
  const cards = useCards()
  const { planning } = usePlanning()
  const { docs, setPlanTab } = useStore()
  const openScene = useOpenScene()
  const [area, setArea] = useState<Area | 'all'>('all')
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [lib, setLib] = useState<string | null>(null)
  const chars = cards.filter((c) => c.kind === 'character')
  const issues = useMemo(() => clinic({
    scripts: scripts.map((s) => ({ path: s.path, name: s.name, scenes: s.scenes.map((x, i) => ({ heading: x.heading, characters: x.characters, wordCount: x.wordCount, minutes: s.minutes[i] ?? 0 })), acts: s.acts, sceneMeta: s.sceneMeta })),
    characters: chars.map((c) => ({ name: c.name, group: c.group, appearances: c.appearances.length, relationships: ((readFrontmatter(docs.find((d) => d.path === c.path)?.content ?? '').data['relationships'] as { target: string }[] | undefined) ?? []).map((r) => r.target) })),
    planning
  }), [scripts, chars, planning, docs])
  const shown = issues.filter((i) => (area === 'all' || i.area === area) && !dismissed.has(i.title))
  const count = (a: Area | 'all') => issues.filter((i) => (a === 'all' || i.area === a) && !dismissed.has(i.title)).length
  const entry = lib ? byId(lib) : null

  // Matriz track × escena (vista Clinic → Tracks).
  const trackMatrix = scripts.map((s) => ({ s, rows: planning.tracks.map((tr) => ({ tr, pres: s.scenes.map((x) => s.sceneMeta[x.heading]?.track === tr.id) })) }))

  return (
    <main className="page scroll">
      <div className="toolbar wrap">
        {(['all', 'structure', 'characters', 'questions', 'plants', 'tracks', 'pacing', 'ideas'] as const).map((a) => (
          <button key={a} className={area === a ? 'mini on' : 'mini ghost'} onClick={() => setArea(a)}>{a === 'all' ? t('Todo') : t(AREA_LABEL[a])} ({count(a)})</button>
        ))}
        <span className="grow" />
        {(['inconsistency', 'review', 'incomplete', 'info'] as Severity[]).map((sv) => <span key={sv} className="tiny muted"><span className="cdot" style={{ background: SEV_COLOR[sv] }} /> {t(SEV_LABEL[sv]!)}</span>)}
      </div>
      {shown.length === 0 && <p className="muted center">{t('Nada que señalar en esta área. La Clinic muestra señales, no veredictos.')}</p>}
      <div className="grid2">
        {shown.map((i) => (
          <div className="panelbox issue" key={i.id} style={{ borderLeft: 'none' }}>
            <div className="row"><span className="cdot" style={{ background: SEV_COLOR[i.severity] }} /><strong className="grow">{i.title}</strong><span className="pill tiny">{t(AREA_LABEL[i.area])}</span></div>
            <p className="muted tiny">{i.detail}</p>
            <div className="row tiny wrap">
              {i.refs.filter((r) => r.heading).map((r, k) => <button key={k} className="mini ghost" onClick={() => openScene(scripts, r)}>{r.heading.slice(0, 28)} ↗</button>)}
              {i.area === 'questions' && <button className="mini ghost" onClick={() => setPlanTab('questions')}>{t('Abrir preguntas')}</button>}
              {i.area === 'plants' && <button className="mini ghost" onClick={() => setPlanTab('plants')}>{t('Abrir Plant & Payoff')}</button>}
              {i.area === 'tracks' && <button className="mini ghost" onClick={() => setPlanTab('planner')}>{t('Abrir Planner')}</button>}
              <span className="grow" />
              <button className="mini ghost" onClick={() => setDismissed((s) => new Set([...s, i.title]))}>{t('Descartar')}</button>
            </div>
            <div className="chips">{i.techniques.map((id) => byId(id)).filter(Boolean).map((e) => <button key={e!.id} className="chip" onClick={() => setLib(e!.id)}><Icon name="book" size={11} />{e!.title}</button>)}</div>
          </div>
        ))}
      </div>
      {(area === 'all' || area === 'tracks') && planning.tracks.length > 0 && (
        <>
          <h2>{t('Presencia de tracks')}</h2>
          {trackMatrix.map(({ s, rows }) => (
            <div key={s.path} className="panelbox scrollx">
              <div className="muted tiny">{s.name}</div>
              <table className="table planner"><tbody>
                {rows.map(({ tr, pres }) => <tr key={tr.id}><td><span className="cdot" style={{ background: tr.color }} /> {tr.name}</td>{pres.map((p, i) => <td key={i} className="cell"><span className="pip" style={{ background: p ? tr.color : 'var(--line)' }} /></td>)}</tr>)}
              </tbody></table>
            </div>
          ))}
        </>
      )}
      {entry && (
        <div className="modal-backdrop" onClick={() => setLib(null)}>
          <div className="modal" style={{ width: 'min(560px,92vw)' }} onClick={(e) => e.stopPropagation()}>
            <div className="row"><h1>{entry.title}</h1><span className="grow" /><button className="mini ghost" onClick={() => setLib(null)}>{t('Cerrar')}</button></div>
            <p className="muted tiny">{entry.category}</p>
            <p>{entry.summary}</p>
            <p><b>{t('Cuándo')}:</b> {entry.when}</p>
            <p><b>{t('Cuidado')}:</b> {entry.pitfalls}</p>
          </div>
        </div>
      )}
    </main>
  )
}
