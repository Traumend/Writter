import { useState } from 'react'
import { dayCast, eighths, type ShootingDay } from '../../../core/preproduction'
import { t } from '../../i18n'
import { BlurInput, Icon } from '../../ui'
import { uid, usePlan, useProdScenes } from './data'

// Plan de rodaje (ScriptWriterX §40): jornadas con sus escenas, páginas en octavos y reparto del día.
export function Plan() {
  const scenes = useProdScenes()
  const { value: plan, save } = usePlan()
  const [sel, setSel] = useState<string | null>(plan.days[0]?.id ?? null)
  const days = plan.days
  const day = days.find((d) => d.id === sel) ?? days[0]
  const byKey = new Map(scenes.map((s) => [s.key, s]))
  const charsOf = (k: string) => byKey.get(k)?.characters ?? []
  const minutesOf = (d: ShootingDay) => d.scenes.reduce((a, k) => a + (byKey.get(k)?.minutes ?? 0), 0)
  const assigned = new Set(days.flatMap((d) => d.scenes))

  const addDay = () => {
    const n = days.length + 1
    const id = uid()
    const last = days[days.length - 1]?.date
    const date = last ? new Date(new Date(last).getTime() + 86400000).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
    void save({ days: [...days, { id, date, call: '07:00', location: '', scenes: [], notes: `${t('Jornada')} ${n}` }] })
    setSel(id)
  }
  const upd = (id: string, p: Partial<ShootingDay>) => void save({ days: days.map((d) => (d.id === id ? { ...d, ...p } : d)) })
  const toggleScene = (k: string) => day && upd(day.id, { scenes: day.scenes.includes(k) ? day.scenes.filter((x) => x !== k) : [...day.scenes, k] })

  return (
    <div className="split two prod-plan">
      <aside>
        <div className="row"><h2>{t('Jornadas')}</h2><span className="grow" /><button className="mini" onClick={addDay}><Icon name="plus" size={12} />{t('Día')}</button></div>
        <ul>
          {days.map((d, i) => (
            <li key={d.id} className={d.id === day?.id ? 'active' : ''} onClick={() => setSel(d.id)}>
              <span className="muted">{i + 1}.</span> <span className="grow ell">{d.date || t('sin fecha')}</span>
              <span className="muted tiny">{d.scenes.length} esc · {eighths(minutesOf(d))}</span>
            </li>
          ))}
          {!days.length && <li className="muted tiny">{t('Sin jornadas. Crea la primera.')}</li>}
        </ul>
        <p className="muted tiny">{assigned.size}/{scenes.length} {t('escenas planificadas')}</p>
      </aside>

      <section className="scroll">
        {!day ? <p className="muted center">{t('Crea una jornada para empezar a repartir escenas.')}</p> : (
          <>
            <div className="toolbar wrap">
              <BlurInput type="date" value={day.date} onCommit={(v) => upd(day.id, { date: v })} />
              <label className="row tiny">{t('Hora de llamado')} <BlurInput type="time" value={day.call} onCommit={(v) => upd(day.id, { call: v })} /></label>
              <span style={{ minWidth: 180 }}><BlurInput value={day.location} placeholder={t('Locación de la jornada')} onCommit={(v) => upd(day.id, { location: v })} /></span>
              <span className="grow" />
              <span className="pill">{eighths(minutesOf(day))} {t('págs')}</span>
              <button className="mini ghost danger" onClick={() => { void save({ days: days.filter((d) => d.id !== day.id) }); setSel(null) }}><Icon name="trash" size={12} />{t('Quitar jornada')}</button>
            </div>
            <BlurInput textarea rows={2} value={day.notes} placeholder={t('Notas de la jornada')} onCommit={(v) => upd(day.id, { notes: v })} />

            <h2>{t('Reparto del día')}</h2>
            <div className="chips">{dayCast(day, charsOf).map((c) => <span key={c} className="chip">{c}</span>)}{!day.scenes.length && <span className="muted tiny">{t('Añade escenas para ver el reparto.')}</span>}</div>

            <h2>{t('Escenas')}</h2>
            <table className="table">
              <thead><tr><th /><th>#</th><th>{t('Escena')}</th><th>{t('Episodio')}</th><th>{t('Páginas')}</th><th>{t('Reparto')}</th></tr></thead>
              <tbody>
                {scenes.map((s) => {
                  const mine = day.scenes.includes(s.key)
                  const other = !mine && assigned.has(s.key)
                  return (
                    <tr key={s.key} className={other ? 'muted' : ''}>
                      <td><input type="checkbox" checked={mine} onChange={() => toggleScene(s.key)} title={other ? t('Ya está en otra jornada') : ''} /></td>
                      <td>{s.index + 1}</td>
                      <td className="ell">{s.heading}</td>
                      <td className="tiny">{s.scriptName}</td>
                      <td className="tiny">{eighths(s.minutes)}</td>
                      <td className="tiny ell">{s.characters.join(', ')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </>
        )}
      </section>
    </div>
  )
}
