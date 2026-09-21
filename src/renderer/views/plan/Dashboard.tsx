import { useMemo } from 'react'
import { clinic } from '../../../core/clinic'
import { readFrontmatter } from '../../../core/frontmatter'
import { resolveRef } from '../../../core/planning'
import { t } from '../../i18n'
import { useStore } from '../../store'
import { useCards, usePlanning, useScripts } from './data'
import { SEV_COLOR, SEV_LABEL } from './shared'

// Dashboard: vista ejecutiva del proyecto (progreso, estructura, personajes, preguntas, plants, actividad).
export function Dashboard() {
  const scripts = useScripts()
  const cards = useCards()
  const { planning, save } = usePlanning()
  const { docs, setTab, setPlanTab, versions } = useStore()
  const words = scripts.reduce((a, s) => a + s.words, 0)
  const scenes = scripts.reduce((a, s) => a + s.scenes.length, 0)
  const chars = cards.filter((c) => c.kind === 'character')
  const byGroup = (g: string) => chars.filter((c) => c.group === g).length
  const headings = new Map(scripts.map((s) => [s.path, s.scenes.map((x) => x.heading)]))
  const qOpen = planning.questions.filter((q) => q.status === 'open' || q.status === 'developing').length
  const qPartial = planning.questions.filter((q) => q.status === 'partial').length
  const qDone = planning.questions.filter((q) => q.status === 'answered').length
  const orphanPlants = planning.plants.filter((p) => p.payoffs.length === 0).length
  const orphanPayoffs = planning.plants.filter((p) => !p.plant).length
  const complete = planning.plants.filter((p) => p.plant && p.payoffs.length > 0 && resolveRef(p.plant, headings) !== null).length
  const issues = useMemo(() => clinic({
    scripts: scripts.map((s) => ({ path: s.path, name: s.name, scenes: s.scenes.map((x, i) => ({ heading: x.heading, characters: x.characters, wordCount: x.wordCount, minutes: s.minutes[i] ?? 0 })), acts: s.acts, sceneMeta: s.sceneMeta })),
    characters: chars.map((c) => ({ name: c.name, group: c.group, appearances: c.appearances.length, relationships: ((readFrontmatter(docs.find((d) => d.path === c.path)?.content ?? '').data['relationships'] as { target: string }[] | undefined) ?? []).map((r) => r.target) })),
    planning
  }), [scripts, chars, planning, docs])
  const pct = planning.goal > 0 ? Math.min(100, Math.round((words / planning.goal) * 100)) : 0
  const recent = [...versions].sort((a, b) => b.ts - a.ts).slice(0, 6)
  const go = (tab: 'dashboard' | 'planner' | 'questions' | 'plants' | 'ideas' | 'clinic' | 'index' | 'library') => setPlanTab(tab)

  return (
    <main className="page scroll">
      <div className="grid3">
        <div className="panelbox">
          <h2>{t('Progreso')}</h2>
          <div className="big">{words.toLocaleString()} <span className="muted tiny">{t('palabras')}</span></div>
          <div className="row tiny"><span className="muted">{t('Meta')}</span><input type="number" min={0} value={planning.goal || ''} placeholder="0" style={{ width: 110 }} onChange={(e) => void save({ goal: Number(e.target.value) || 0 })} /><span className="muted">{planning.goal ? `${pct}%` : ''}</span></div>
          {planning.goal > 0 && <div className="bt-prog"><div style={{ width: `${pct}%` }} /></div>}
          <div className="row tiny muted" style={{ marginTop: 8 }}><span>{scenes} {t('escenas')}</span><span>·</span><span>{scripts.length} {t('episodios')}</span><span>·</span><span>{chars.length} {t('personajes')}</span></div>
        </div>
        <div className="panelbox">
          <h2>{t('Estructura')}</h2>
          {scripts.map((s) => (
            <div key={s.path} className="tiny" style={{ marginBottom: 6 }}>
              <div className="muted ell">{s.name} · {s.scenes.length} {t('esc.')}</div>
              <div className="minitl">
                {s.acts.length ? s.acts.map((a, i) => <span key={i} title={a.title} style={{ flex: Math.max(1, a.to - a.from + 1) }}>{a.title.slice(0, 12)}</span>) : <span className="muted">{t('Sin actos')}</span>}
              </div>
            </div>
          ))}
          <button className="mini ghost" onClick={() => { setTab('dev'); useStore.getState().setDevTab('beats') }}>Beat Timeline</button>
        </div>
        <div className="panelbox">
          <h2>{t('Personajes')}</h2>
          <div className="row tiny"><span>{t('Protagonistas')}</span><span className="grow" /><b>{byGroup('protagonist')}</b></div>
          <div className="row tiny"><span>{t('Antagonistas')}</span><span className="grow" /><b>{byGroup('antagonist')}</b></div>
          <div className="row tiny"><span>{t('Secundarios')}</span><span className="grow" /><b>{byGroup('supporting')}</b></div>
          <div className="row tiny"><span>{t('Sin conexión al guion')}</span><span className="grow" /><b>{chars.filter((c) => c.appearances.length === 0).length}</b></div>
          <button className="mini ghost" onClick={() => setTab('breakdown')}>Breakdown</button>
        </div>
        <div className="panelbox link" onClick={() => go('questions')}>
          <h2>{t('Preguntas dramáticas')}</h2>
          <div className="row tiny"><span>{t('Abiertas')}</span><span className="grow" /><b style={{ color: '#c47d1a' }}>{qOpen}</b></div>
          <div className="row tiny"><span>{t('Parciales')}</span><span className="grow" /><b>{qPartial}</b></div>
          <div className="row tiny"><span>{t('Respondidas')}</span><span className="grow" /><b style={{ color: '#3ddc97' }}>{qDone}</b></div>
        </div>
        <div className="panelbox link" onClick={() => go('plants')}>
          <h2>Plant & Payoff</h2>
          <div className="row tiny"><span>{t('Siembras sin pago')}</span><span className="grow" /><b style={{ color: '#c47d1a' }}>{orphanPlants}</b></div>
          <div className="row tiny"><span>{t('Pagos sin siembra')}</span><span className="grow" /><b style={{ color: '#e8437f' }}>{orphanPayoffs}</b></div>
          <div className="row tiny"><span>{t('Conexiones completas')}</span><span className="grow" /><b style={{ color: '#3ddc97' }}>{complete}</b></div>
        </div>
        <div className="panelbox link" onClick={() => go('clinic')}>
          <h2>Clinic · {issues.length}</h2>
          {(['inconsistency', 'review', 'incomplete', 'info'] as const).map((sv) => <div key={sv} className="row tiny"><span className="cdot" style={{ background: SEV_COLOR[sv] }} /><span>{t(SEV_LABEL[sv]!)}</span><span className="grow" /><b>{issues.filter((i) => i.severity === sv).length}</b></div>)}
          <div className="row tiny muted"><span>{t('Ideas sin integrar')}</span><span className="grow" /><b>{planning.ideas.length}</b></div>
        </div>
        <div className="panelbox wide">
          <h2>{t('Actividad reciente')}</h2>
          {recent.length === 0 && <p className="muted tiny">{t('Sin actividad registrada en el archivo abierto.')}</p>}
          <ul className="bullets">{recent.map((v) => <li key={v.id} className="tiny">{new Date(v.ts).toLocaleString()} · {v.label ?? v.origin} · {v.bytes} B</li>)}</ul>
        </div>
      </div>
    </main>
  )
}
