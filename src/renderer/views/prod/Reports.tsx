import { useState } from 'react'
import { mdToHtml } from '../../../core/convert'
import { dood, eighths, type DoodCode } from '../../../core/preproduction'
import { t } from '../../i18n'
import { useStore } from '../../store'
import { usePlan, useProdCards, useProdScenes } from './data'

// Centro de reportes (ScriptWriterX §42): los que se derivan de lo que ya hay en el vault.
type Report = 'scenes' | 'characters' | 'matrix' | 'locations' | 'dood' | 'plan'
const REPORTS: [Report, string][] = [
  ['scenes', 'Escenas'], ['characters', 'Personajes'], ['matrix', 'Matriz personajes × escenas'],
  ['locations', 'Locaciones'], ['dood', 'Day Out of Days'], ['plan', 'Plan de rodaje']
]
const DOOD_COLOR: Record<DoodCode, string> = { SW: '#3ddc97', W: '#4f8cff', H: '#c47d1a', WF: '#e8437f', SWF: '#f5c542', D: 'var(--dim)' }

export function Reports() {
  const scenes = useProdScenes()
  const cards = useProdCards()
  const { value: plan } = usePlan()
  const [kind, setKind] = useState<Report>('scenes')
  const byKey = new Map(scenes.map((s) => [s.key, s]))
  const charsOf = (k: string) => byKey.get(k)?.characters ?? []

  const table = (): { cols: string[]; rows: (string | number)[][] } => {
    switch (kind) {
      case 'scenes':
        return { cols: ['#', 'Escena', 'Episodio', 'Páginas', 'Reparto'], rows: scenes.map((s) => [s.index + 1, s.heading, s.scriptName, eighths(s.minutes), s.characters.join(', ')]) }
      case 'characters': {
        const chars = cards.filter((c) => c.kind === 'character')
        return { cols: ['Personaje', 'Escenas', 'Episodios', 'Palabras'], rows: chars.map((c) => [c.name, c.appearances.length, new Set(c.appearances.map((a) => a.script)).size, c.words]) }
      }
      case 'matrix': {
        const names = [...new Set(scenes.flatMap((s) => s.characters))].sort()
        return { cols: ['Escena', ...names], rows: scenes.map((s) => [`${s.index + 1} ${s.heading}`, ...names.map((n) => (s.characters.includes(n) ? 'X' : ''))]) }
      }
      case 'locations': {
        const locs = cards.filter((c) => c.kind === 'location')
        return { cols: ['Locación', 'Escenas', 'Episodios'], rows: locs.map((c) => [c.name, c.appearances.length, new Set(c.appearances.map((a) => a.script)).size]) }
      }
      case 'dood': {
        const rows = dood(plan.days, charsOf)
        return { cols: ['Personaje', ...plan.days.map((d, i) => d.date || `D${i + 1}`)], rows: rows.map((r) => [r.character, ...r.codes]) }
      }
      case 'plan':
        return {
          cols: ['Día', 'Fecha', 'Hora de llamado', 'Locación', 'Escenas', 'Páginas'],
          rows: plan.days.map((d, i) => [i + 1, d.date, d.call, d.location, d.scenes.length, eighths(d.scenes.reduce((a, k) => a + (byKey.get(k)?.minutes ?? 0), 0))])
        }
    }
  }
  const { cols, rows } = table()
  const label = REPORTS.find(([k]) => k === kind)?.[1] ?? ''
  const csv = () => {
    const esc = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`
    void window.api.exportText([cols.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n'), `reporte-${kind}.csv`)
  }
  const pdf = () => {
    const md = `${t(label)}\n\n${[cols.join(' | '), ...rows.map((r) => r.join(' | '))].join('\n')}\n`
    void window.api.exportPdf(mdToHtml(md, t(label)), `reporte-${kind}.pdf`, { paper: 'Letter' })
  }

  return (
    <div className="page scroll">
      <div className="toolbar wrap">
        {REPORTS.map(([k, l]) => <button key={k} className={kind === k ? 'mini on' : 'mini ghost'} onClick={() => setKind(k)}>{t(l)}</button>)}
        <span className="grow" />
        <span className="muted tiny">{rows.length} {t('filas')}</span>
        <button className="mini ghost" onClick={csv}>CSV</button>
        <button className="mini ghost" onClick={pdf}>PDF</button>
      </div>
      {kind === 'dood' && !plan.days.length && <p className="muted">{t('El DOOD necesita jornadas en el plan de rodaje.')}</p>}
      <div className="scrollx">
        <table className="table">
          <thead><tr>{cols.map((c) => <th key={c}>{t(c)}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((cell, j) => (
                  <td key={j} style={kind === 'dood' && j > 0 ? { color: DOOD_COLOR[cell as DoodCode], textAlign: 'center' } : undefined}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="muted center">{t('Nada que reportar todavía.')}</p>}
    </div>
  )
}
