import { useState } from 'react'
import { mdToHtml } from '../../../core/convert'
import { dayCast, eighths } from '../../../core/preproduction'
import { t } from '../../i18n'
import { useStore } from '../../store'
import { usePlan, useProdScenes, useTeam } from './data'

// Llamados (ScriptWriterX §41): la hoja del día se compone de lo que ya existe —jornada, escenas,
// reparto, equipo y locación— y se guarda como .md en assets/preproduccion/llamados/.
export function CallSheets() {
  const scenes = useProdScenes()
  const { value: plan } = usePlan()
  const { value: team } = useTeam()
  const { createFile, files, vault } = useStore()
  const [sel, setSel] = useState<string | null>(plan.days[0]?.id ?? null)
  const day = plan.days.find((d) => d.id === sel) ?? plan.days[0]
  const byKey = new Map(scenes.map((s) => [s.key, s]))
  const charsOf = (k: string) => byKey.get(k)?.characters ?? []

  if (!plan.days.length) return <div className="page"><p className="muted center">{t('Crea jornadas en el Plan de rodaje para generar llamados.')}</p></div>

  const sheet = (): string => {
    if (!day) return ''
    const cast = dayCast(day, charsOf)
    const actorOf = (c: string) => team.talent.find((x) => x.character === c)?.name ?? ''
    const loc = team.locations.find((l) => l.name === day.location || l.set === day.location)
    const rows = day.scenes.map((k) => byKey.get(k)).filter(Boolean)
    const mins = rows.reduce((a, s) => a + (s?.minutes ?? 0), 0)
    return [
      `# ${t('Llamado')} · ${day.date}`,
      '',
      `${t('Hora de llamado')}: ${day.call}`,
      `${t('Locación')}: ${day.location || '—'}${loc?.address ? ` (${loc.address})` : ''}`,
      `${t('Producción')}: ${vault?.config.cover.title || ''}`,
      '',
      `## ${t('Escenas')} (${rows.length} · ${eighths(mins)} ${t('págs')})`,
      ...rows.map((s) => `- ${s!.index + 1}. ${s!.heading} — ${s!.scriptName} — ${eighths(s!.minutes)} — ${s!.characters.join(', ')}`),
      '',
      `## ${t('Reparto')}`,
      ...cast.map((c) => `- ${c}${actorOf(c) ? ` — ${actorOf(c)}` : ''}${team.talent.find((x) => x.character === c)?.phone ? ` — ${team.talent.find((x) => x.character === c)!.phone}` : ''}`),
      '',
      `## ${t('Equipo')}`,
      ...team.crew.map((c) => `- ${c.dept} ${c.role}: ${c.name}${c.phone ? ` — ${c.phone}` : ''}`),
      '',
      `## ${t('Notas')}`,
      day.notes || '—',
      ''
    ].join('\n')
  }

  const md = sheet()
  const path = day ? `assets/preproduccion/llamados/${day.date || day.id}.md` : ''
  const exists = files.some((f) => f.path === path)

  return (
    <div className="page scroll">
      <div className="toolbar wrap">
        <select value={day?.id ?? ''} onChange={(e) => setSel(e.target.value)}>
          {plan.days.map((d, i) => <option key={d.id} value={d.id}>{i + 1}. {d.date || t('sin fecha')}</option>)}
        </select>
        <span className="grow" />
        <button disabled={!day || exists} onClick={() => void createFile(path, `---\ntype: llamado\nfecha: "${day!.date}"\nestado: borrador\n---\n\n${md}`, false)}>{exists ? t('Ya guardado') : t('Guardar en el vault')}</button>
        <button className="ghost" disabled={!day} onClick={() => void window.api.exportPdf(mdToHtml(md, `Llamado ${day!.date}`), `llamado-${day!.date || 'dia'}.pdf`, { paper: 'Letter' })}>PDF</button>
      </div>
      <pre className="scenetext callsheet">{md}</pre>
    </div>
  )
}
