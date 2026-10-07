import { BUDGET_GROUPS, CREW_DEPTS, budgetTotals, itemTotal, type BudgetGroup, type BudgetItem } from '../../../core/preproduction'
import { t } from '../../i18n'
import { BlurInput, Icon } from '../../ui'
import { uid, useBudget } from './data'

// Presupuesto por partidas (ScriptWriterX §46): sobre la línea, bajo la línea y post, con contingencia.
// Sin fiscalidad de ningún país: eso es un módulo aparte si algún día entra.
export function Budget() {
  const { value: budget, save } = useBudget()
  const totals = budgetTotals(budget.items, budget.contingency)
  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 })
  const upd = (id: string, p: Partial<BudgetItem>) => void save({ items: budget.items.map((x) => (x.id === id ? { ...x, ...p } : x)) })
  const add = (group: BudgetGroup) => void save({ items: [...budget.items, { id: uid(), group, category: CREW_DEPTS[2]![0], description: '', qty: 1, unit: 'día', rate: 0, days: 1 }] })

  return (
    <div className="page scroll">
      <div className="toolbar wrap">
        <strong>{t('Presupuesto')}</strong>
        <span className="muted tiny">{budget.items.length} {t('partidas')}</span>
        <span className="grow" />
        <label className="row tiny">{t('Contingencia')} <input type="number" min={0} max={50} style={{ width: 64 }} value={budget.contingency} onChange={(e) => void save({ contingency: Number(e.target.value) || 0 })} />%</label>
        <label className="row tiny">{t('Moneda')} <span style={{ width: 70 }}><BlurInput value={budget.currency} onCommit={(v) => void save({ currency: v })} /></span></label>
        {BUDGET_GROUPS.map(([g, label]) => <button key={g} className="mini" onClick={() => add(g)}><Icon name="plus" size={12} />{t(label)}</button>)}
      </div>

      <div className="grid3">
        {BUDGET_GROUPS.map(([g, label]) => (
          <div className="panelbox" key={g}>
            <h2>{t(label)}</h2>
            <div className="big">{fmt(totals.byGroup[g])} <span className="muted tiny">{budget.currency}</span></div>
          </div>
        ))}
      </div>

      {BUDGET_GROUPS.map(([g, label]) => {
        const items = budget.items.filter((i) => i.group === g)
        if (!items.length) return null
        return (
          <div key={g}>
            <h2>{t(label)}</h2>
            <table className="table">
              <thead><tr><th>{t('Partida')}</th><th>{t('Concepto')}</th><th>{t('Cant.')}</th><th>{t('Unidad')}</th><th>{t('Tarifa')}</th><th>{t('Días')}</th><th>{t('Total')}</th><th /></tr></thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}>
                    <td><select value={i.category} onChange={(e) => upd(i.id, { category: e.target.value })}>{CREW_DEPTS.map(([code, l]) => <option key={code} value={code}>{code} {t(l)}</option>)}</select></td>
                    <td style={{ minWidth: 180 }}><BlurInput value={i.description} onCommit={(v) => upd(i.id, { description: v })} /></td>
                    <td><input type="number" min={0} style={{ width: 64 }} value={i.qty} onChange={(e) => upd(i.id, { qty: Number(e.target.value) || 0 })} /></td>
                    <td><BlurInput value={i.unit} onCommit={(v) => upd(i.id, { unit: v })} /></td>
                    <td><input type="number" min={0} style={{ width: 96 }} value={i.rate} onChange={(e) => upd(i.id, { rate: Number(e.target.value) || 0 })} /></td>
                    <td><input type="number" min={0} style={{ width: 64 }} value={i.days} onChange={(e) => upd(i.id, { days: Number(e.target.value) || 0 })} /></td>
                    <td><b>{fmt(itemTotal(i))}</b></td>
                    <td><button className="mini ghost" title={t('Quitar')} onClick={() => void save({ items: budget.items.filter((x) => x.id !== i.id) })}><Icon name="close" size={12} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}

      <div className="panelbox">
        <div className="row"><span>{t('Subtotal')}</span><span className="grow" /><b>{fmt(totals.subtotal)} {budget.currency}</b></div>
        <div className="row"><span>{t('Contingencia')} {budget.contingency}%</span><span className="grow" /><b>{fmt(totals.contingency)}</b></div>
        <div className="row"><strong>{t('Total')}</strong><span className="grow" /><strong>{fmt(totals.total)} {budget.currency}</strong></div>
      </div>
      {!budget.items.length && <p className="muted center">{t('Sin partidas. Añade una en el grupo que corresponda.')}</p>}
    </div>
  )
}
