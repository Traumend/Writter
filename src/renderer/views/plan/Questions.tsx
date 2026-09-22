import { useState } from 'react'
import { QUESTION_STATUS, uid, type Question, type QuestionStatus } from '../../../core/planning'
import { t } from '../../i18n'
import { Icon, BlurInput } from '../../ui'
import { refLabel, useCards, usePlanning, useScripts } from './data'
import { CharChips, SceneRefPicker, useOpenScene } from './shared'

const Q_LABEL: Record<QuestionStatus, string> = { open: 'Abierta', developing: 'En desarrollo', partial: 'Parcialmente respondida', answered: 'Respondida', abandoned: 'Abandonada' }
const Q_COLOR: Record<QuestionStatus, string> = { open: '#c47d1a', developing: '#4f8cff', partial: '#b388ff', answered: '#3ddc97', abandoned: '#8b91a0' }

// Story Questions: preguntas que la historia plantea al público, con escena de introducción y de resolución.
export function Questions() {
  const scripts = useScripts()
  const cards = useCards()
  const { planning, save } = usePlanning()
  const openScene = useOpenScene()
  const [text, setText] = useState('')
  const [filter, setFilter] = useState<'all' | QuestionStatus>('all')
  const chars = cards.filter((c) => c.kind === 'character').map((c) => c.name)
  const upd = (id: string, p: Partial<Question>) => void save({ questions: planning.questions.map((q) => (q.id === id ? { ...q, ...p } : q)) })
  const add = () => { if (!text.trim()) return; void save({ questions: [...planning.questions, { id: uid(), text: text.trim(), category: '', status: 'open', importance: 2, characters: [], notes: '' }] }); setText('') }
  const list = planning.questions.filter((q) => filter === 'all' || q.status === filter)
  const total = scripts.reduce((a, s) => a + s.scenes.length, 0)

  return (
    <main className="page scroll">
      <div className="toolbar wrap">
        <input data-new placeholder={t('Nueva pregunta dramática (¿logrará X…?) · Enter')} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} style={{ width: 420 }} />
        <button className="mini" onClick={add}><Icon name="plus" size={12} />{t('Pregunta')}</button>
        <span className="grow" />
        {(['all', ...QUESTION_STATUS] as const).map((s) => <button key={s} className={filter === s ? 'mini on' : 'mini ghost'} onClick={() => setFilter(s)}>{s === 'all' ? t('Todas') : t(Q_LABEL[s])} ({s === 'all' ? planning.questions.length : planning.questions.filter((q) => q.status === s).length})</button>)}
      </div>
      {list.length === 0 && <p className="muted center">{t('Sin preguntas. Una buena historia plantea preguntas y las responde a tiempo.')}</p>}
      {list.map((q) => (
        <div className="panelbox qcard" key={q.id}>
          <div className="row">
            <span className="cdot" style={{ background: Q_COLOR[q.status] }} />
            <BlurInput value={q.text} onCommit={(v) => upd(q.id, { text: v })} />
            <select value={q.status} onChange={(e) => upd(q.id, { status: e.target.value as QuestionStatus })}>{QUESTION_STATUS.map((s) => <option key={s} value={s}>{t(Q_LABEL[s])}</option>)}</select>
            <select value={q.importance} title={t('Importancia')} onChange={(e) => upd(q.id, { importance: Number(e.target.value) })}><option value={1}>★</option><option value={2}>★★</option><option value={3}>★★★</option></select>
            <button className="mini ghost" title={t('Quitar')} onClick={() => void save({ questions: planning.questions.filter((x) => x.id !== q.id) })}><Icon name="close" size={12} /></button>
          </div>
          <div className="row tiny wrap">
            <span className="muted">{t('Se plantea en')}</span><SceneRefPicker value={q.introduced} onChange={(r) => upd(q.id, { introduced: r })} scripts={scripts} />
            <span className="muted">{t('Se resuelve en')}</span><SceneRefPicker value={q.resolved} onChange={(r) => upd(q.id, { resolved: r })} scripts={scripts} />
            <input placeholder={t('Categoría')} value={q.category} onChange={(e) => upd(q.id, { category: e.target.value })} style={{ width: 140 }} />
          </div>
          {/* Línea de tiempo de la pregunta: introducción → resolución sobre el total de escenas. */}
          {(q.introduced || q.resolved) && total > 0 && (
            <div className="qline" title={`${refLabel(q.introduced, scripts)} → ${refLabel(q.resolved, scripts)}`}>
              {[q.introduced, q.resolved].map((r, k) => {
                const s = scripts.find((x) => x.path === r?.script)
                const i = s?.scenes.findIndex((x) => x.heading.trim().toUpperCase() === (r?.heading ?? '').trim().toUpperCase()) ?? -1
                return r && i >= 0 ? <span key={k} className="qdot link" style={{ left: `${(i / Math.max(1, (s?.scenes.length ?? 1) - 1)) * 100}%`, background: k ? '#3ddc97' : '#c47d1a' }} onClick={() => openScene(scripts, r)} title={`#${i + 1}`} /> : null
              })}
            </div>
          )}
          <CharChips all={chars} value={q.characters} onChange={(v) => upd(q.id, { characters: v })} />
          <BlurInput textarea rows={2} value={q.notes} placeholder={t('Notas: pistas intermedias, cómo se responde…')} onCommit={(v) => upd(q.id, { notes: v })} />
        </div>
      ))}
    </main>
  )
}
