import { CREW_DEPTS, type CrewMember, type ShootingLocation, type TalentMember } from '../../../core/preproduction'
import { t } from '../../i18n'
import { BlurInput, Icon } from '../../ui'
import { uid, useProdCards, useTeam } from './data'

// Equipo, talento y locaciones de rodaje (ScriptWriterX §43-45). El talento se enlaza con el
// personaje del guion: la ficha narrativa y la persona real son cosas distintas.
export function Team() {
  const { value: team, save } = useTeam()
  const cards = useProdCards()
  const characters = cards.filter((c) => c.kind === 'character').map((c) => c.name)
  const locations = cards.filter((c) => c.kind === 'location').map((c) => c.name)

  const updCrew = (id: string, p: Partial<CrewMember>) => void save({ crew: team.crew.map((x) => (x.id === id ? { ...x, ...p } : x)) })
  const updTalent = (id: string, p: Partial<TalentMember>) => void save({ talent: team.talent.map((x) => (x.id === id ? { ...x, ...p } : x)) })
  const updLoc = (id: string, p: Partial<ShootingLocation>) => void save({ locations: team.locations.map((x) => (x.id === id ? { ...x, ...p } : x)) })

  return (
    <div className="page scroll">
      <div className="toolbar wrap">
        <strong>{t('Equipo')}</strong>
        <span className="muted tiny">{team.crew.length} crew · {team.talent.length} {t('talento')} · {team.locations.length} {t('locaciones')}</span>
        <span className="grow" />
        <button className="mini" onClick={() => void save({ crew: [...team.crew, { id: uid(), name: '', dept: CREW_DEPTS[2]![0], role: '', phone: '', email: '', rate: '' }] })}><Icon name="plus" size={12} />Crew</button>
        <button className="mini" onClick={() => void save({ talent: [...team.talent, { id: uid(), name: '', character: '', agency: '', phone: '', rate: '' }] })}><Icon name="plus" size={12} />{t('Talento')}</button>
        <button className="mini" onClick={() => void save({ locations: [...team.locations, { id: uid(), name: '', set: '', address: '', contact: '', permit: '', notes: '' }] })}><Icon name="plus" size={12} />{t('Locación')}</button>
      </div>

      <h2>Crew</h2>
      <table className="table">
        <thead><tr><th>{t('Nombre')}</th><th>{t('Departamento')}</th><th>{t('Puesto')}</th><th>{t('Teléfono')}</th><th>Email</th><th>{t('Tarifa')}</th><th /></tr></thead>
        <tbody>
          {team.crew.map((c) => (
            <tr key={c.id}>
              <td><BlurInput value={c.name} onCommit={(v) => updCrew(c.id, { name: v })} /></td>
              <td><select value={c.dept} onChange={(e) => updCrew(c.id, { dept: e.target.value })}>{CREW_DEPTS.map(([code, label]) => <option key={code} value={code}>{code} {t(label)}</option>)}</select></td>
              <td><BlurInput value={c.role} onCommit={(v) => updCrew(c.id, { role: v })} /></td>
              <td><BlurInput value={c.phone} onCommit={(v) => updCrew(c.id, { phone: v })} /></td>
              <td><BlurInput value={c.email} onCommit={(v) => updCrew(c.id, { email: v })} /></td>
              <td><BlurInput value={c.rate} onCommit={(v) => updCrew(c.id, { rate: v })} /></td>
              <td><button className="mini ghost" title={t('Quitar')} onClick={() => void save({ crew: team.crew.filter((x) => x.id !== c.id) })}><Icon name="close" size={12} /></button></td>
            </tr>
          ))}
          {!team.crew.length && <tr><td colSpan={7} className="muted tiny">{t('Sin equipo todavía.')}</td></tr>}
        </tbody>
      </table>

      <h2>{t('Talento')}</h2>
      <table className="table">
        <thead><tr><th>{t('Nombre')}</th><th>{t('Personaje')}</th><th>{t('Agencia')}</th><th>{t('Teléfono')}</th><th>{t('Tarifa')}</th><th /></tr></thead>
        <tbody>
          {team.talent.map((x) => (
            <tr key={x.id}>
              <td><BlurInput value={x.name} onCommit={(v) => updTalent(x.id, { name: v })} /></td>
              <td>
                <select value={x.character} onChange={(e) => updTalent(x.id, { character: e.target.value })}>
                  <option value="">—</option>
                  {characters.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </td>
              <td><BlurInput value={x.agency} onCommit={(v) => updTalent(x.id, { agency: v })} /></td>
              <td><BlurInput value={x.phone} onCommit={(v) => updTalent(x.id, { phone: v })} /></td>
              <td><BlurInput value={x.rate} onCommit={(v) => updTalent(x.id, { rate: v })} /></td>
              <td><button className="mini ghost" title={t('Quitar')} onClick={() => void save({ talent: team.talent.filter((y) => y.id !== x.id) })}><Icon name="close" size={12} /></button></td>
            </tr>
          ))}
          {!team.talent.length && <tr><td colSpan={6} className="muted tiny">{t('Sin talento todavía. El personaje vive en el guion; aquí va quien lo interpreta.')}</td></tr>}
        </tbody>
      </table>

      <h2>{t('Locaciones de rodaje')}</h2>
      <table className="table">
        <thead><tr><th>{t('Nombre real')}</th><th>{t('Set del guion')}</th><th>{t('Dirección postal')}</th><th>{t('Contacto')}</th><th>{t('Permiso')}</th><th /></tr></thead>
        <tbody>
          {team.locations.map((l) => (
            <tr key={l.id}>
              <td><BlurInput value={l.name} onCommit={(v) => updLoc(l.id, { name: v })} /></td>
              <td>
                <select value={l.set} onChange={(e) => updLoc(l.id, { set: e.target.value })}>
                  <option value="">—</option>
                  {locations.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </td>
              <td><BlurInput value={l.address} onCommit={(v) => updLoc(l.id, { address: v })} /></td>
              <td><BlurInput value={l.contact} onCommit={(v) => updLoc(l.id, { contact: v })} /></td>
              <td><BlurInput value={l.permit} onCommit={(v) => updLoc(l.id, { permit: v })} /></td>
              <td><button className="mini ghost" title={t('Quitar')} onClick={() => void save({ locations: team.locations.filter((y) => y.id !== l.id) })}><Icon name="close" size={12} /></button></td>
            </tr>
          ))}
          {!team.locations.length && <tr><td colSpan={6} className="muted tiny">{t('Sin locaciones de rodaje. El lugar del guion y el sitio real son cosas distintas.')}</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
