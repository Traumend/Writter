import { useState } from 'react'
import { resolveRef, uid, type Plant } from '../../../core/planning'
import { t } from '../../i18n'
import { Icon, BlurInput } from '../../ui'
import { refLabel, useCards, usePlanning, useScripts } from './data'
import { CharChips, SceneRefPicker, useOpenScene } from './shared'

// Plant & Payoff: siembras y pagos con referencia a escenas, distancia y alertas (siembra sin pago, pago sin siembra, orden invertido).
export function Plants() {
  const scripts = useScripts()
  const cards = useCards()
  const { planning, save } = usePlanning()
  const openScene = useOpenScene()
  const [title, setTitle] = useState('')
  const chars = cards.filter((c) => c.kind === 'character').map((c) => c.name)
  const headings = new Map(scripts.map((s) => [s.path, s.scenes.map((x) => x.heading)]))
  const upd = (id: string, p: Partial<Plant>) => void save({ plants: planning.plants.map((x) => (x.id === id ? { ...x, ...p } : x)) })
  const add = () => { if (!title.trim()) return; void save({ plants: [...planning.plants, { id: uid(), title: title.trim(), type: '', payoffs: [], characters: [], notes: '' }] }); setTitle('') }
  const distance = (p: Plant) => {
    const a = resolveRef(p.plant, headings), b = resolveRef(p.payoffs[0], headings)
    if (a === null || b === null || !p.plant || !p.payoffs[0] || p.plant.script !== p.payoffs[0].script) return null
    return b - a
  }
  const status = (p: Plant): [string, string] => {
    const d = distance(p)
    if (!p.plant && p.payoffs.length) return [t('pago sin siembra'), '#e8437f']
    if (!p.payoffs.length) return [t('sin resolver'), '#c47d1a']
    if (d !== null && d < 0) return [t('orden invertido'), '#e8437f']
    if (d === null) return [t('referencia incompleta'), '#4f8cff']
    return [`${d} ${t('escenas')}`, '#3ddc97']
  }

  return (
    <main className="page scroll">
      <div className="toolbar wrap">
        <input placeholder={t('Nueva siembra (objeto, frase, gesto…) · Enter')} value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} style={{ width: 380 }} />
        <button className="mini" onClick={add}><Icon name="plus" size={12} />Plant</button>
        <span className="grow" />
        <span className="pill warn">{planning.plants.filter((p) => !p.payoffs.length).length} {t('sin pago')}</span>
        <span className="pill" style={{ color: '#e8437f' }}>{planning.plants.filter((p) => !p.plant).length} {t('sin siembra')}</span>
      </div>
      <table className="table">
        <thead><tr><th>Plant</th><th>{t('Se planta')}</th><th>Payoff(s)</th><th>{t('Distancia')}</th><th /></tr></thead>
        <tbody>
          {planning.plants.map((p) => {
            const [label, color] = status(p)
            return (
              <tr key={p.id} className="vtop">
                <td>
                  <BlurInput value={p.title} onCommit={(v) => upd(p.id, { title: v })} />
                  <input placeholder={t('Tipo (objeto, información, gesto…)')} value={p.type} onChange={(e) => upd(p.id, { type: e.target.value })} />
                  <CharChips all={chars} value={p.characters} onChange={(v) => upd(p.id, { characters: v })} />
                </td>
                <td>
                  <SceneRefPicker value={p.plant} onChange={(r) => upd(p.id, { plant: r })} scripts={scripts} />
                  {p.plant && <button className="mini ghost" onClick={() => openScene(scripts, p.plant)}>{refLabel(p.plant, scripts)} ↗</button>}
                </td>
                <td>
                  {p.payoffs.map((po, i) => (
                    <div className="row tiny" key={i}>
                      <SceneRefPicker value={po} onChange={(r) => upd(p.id, { payoffs: r ? p.payoffs.map((x, j) => (j === i ? r : x)) : p.payoffs.filter((_, j) => j !== i) })} scripts={scripts} />
                      <button className="mini ghost" onClick={() => openScene(scripts, po)}>{refLabel(po, scripts)} ↗</button>
                    </div>
                  ))}
                  <button className="mini ghost" onClick={() => upd(p.id, { payoffs: [...p.payoffs, { script: scripts[0]?.path ?? '', heading: scripts[0]?.scenes[0]?.heading ?? '' }] })}><Icon name="plus" size={12} />payoff</button>
                </td>
                <td><span className="pill" style={{ color }}>{label}</span></td>
                <td><button className="mini ghost" title={t('Quitar')} onClick={() => void save({ plants: planning.plants.filter((x) => x.id !== p.id) })}><Icon name="close" size={12} /></button></td>
              </tr>
            )
          })}
          {planning.plants.length === 0 && <tr><td colSpan={5} className="muted tiny">{t('Sin siembras registradas. Registra cada detalle que deba cobrar sentido más adelante.')}</td></tr>}
        </tbody>
      </table>
    </main>
  )
}
