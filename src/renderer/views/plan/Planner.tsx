import { useState } from 'react'
import { SCENE_STATUS, TRACK_COLORS, uid, type SceneStatus } from '../../../core/planning'
import { t } from '../../i18n'
import { Icon, BlurInput } from '../../ui'
import { useCards, usePlanning, useSceneMetaWriter, useScripts } from './data'
import { useOpenScene } from './shared'

const STATUS_LABEL: Record<SceneStatus, string> = { idea: 'Idea', outline: 'Escaleta', planned: 'Planeada', draft: 'Borrador', revision: 'Necesita revisión', revised: 'Revisada', final: 'Final', cut: 'Cortada' }
const STATUS_COLOR: Record<SceneStatus, string> = { idea: '#8b91a0', outline: '#59c1d6', planned: '#4f8cff', draft: '#c47d1a', revision: '#e8437f', revised: '#b388ff', final: '#3ddc97', cut: '#555' }

// Story Planner: tracks (líneas narrativas) × escenas del guion, con estado y POV por escena.
export function Planner() {
  const scripts = useScripts()
  const cards = useCards()
  const { planning, save } = usePlanning()
  const writeMeta = useSceneMetaWriter()
  const openScene = useOpenScene()
  const [ep, setEp] = useState<string>(scripts[0]?.path ?? '')
  const [newTrack, setNewTrack] = useState('')
  const script = scripts.find((s) => s.path === ep) ?? scripts[0]
  const chars = cards.filter((c) => c.kind === 'character').map((c) => c.name)
  const addTrack = () => { if (!newTrack.trim()) return; void save({ tracks: [...planning.tracks, { id: uid(), name: newTrack.trim(), color: TRACK_COLORS[planning.tracks.length % TRACK_COLORS.length]! }] }); setNewTrack('') }
  const delTrack = (id: string) => void save({ tracks: planning.tracks.filter((x) => x.id !== id) })
  if (!script) return <main className="page"><p className="muted center">{t('Crea o abre un guion.')}</p></main>
  const meta = (h: string) => script.sceneMeta[h] ?? {}

  return (
    <main className="page scroll">
      <div className="toolbar wrap">
        <select value={script.path} onChange={(e) => setEp(e.target.value)}>{scripts.map((s) => <option key={s.path} value={s.path}>{s.name}</option>)}</select>
        <span className="muted tiny">{script.scenes.length} {t('escenas')} · {planning.tracks.length} tracks</span>
        <span className="grow" />
        <input placeholder={t('Nuevo track · Enter')} value={newTrack} onChange={(e) => setNewTrack(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTrack()} style={{ width: 200 }} />
        <button className="mini" onClick={addTrack}><Icon name="plus" size={12} />Track</button>
      </div>

      {/* Matriz de presencia track × escena: detecta subtramas abandonadas de un vistazo. */}
      <div className="panelbox scrollx">
        <table className="table planner">
          <thead><tr><th>Track</th>{script.scenes.map((s, i) => <th key={i} title={s.heading} className="link" onClick={() => openScene(scripts, { script: script.path, heading: s.heading })}>{i + 1}</th>)}<th /></tr></thead>
          <tbody>
            {planning.tracks.map((tr) => (
              <tr key={tr.id}>
                <td><span className="cdot" style={{ background: tr.color }} /> <BlurInput value={tr.name} onCommit={(v) => void save({ tracks: planning.tracks.map((x) => (x.id === tr.id ? { ...x, name: v } : x)) })} /></td>
                {script.scenes.map((s, i) => {
                  const on = meta(s.heading).track === tr.id
                  return <td key={i} className="cell" onClick={() => void writeMeta(script, s.heading, { track: on ? '' : tr.id })}><span className="pip" style={{ background: on ? tr.color : 'var(--line)' }} /></td>
                })}
                <td><button className="mini ghost" title={t('Quitar')} onClick={() => delTrack(tr.id)}><Icon name="close" size={12} /></button></td>
              </tr>
            ))}
            {planning.tracks.length === 0 && <tr><td colSpan={script.scenes.length + 2} className="muted tiny">{t('Sin tracks. Crea uno (Trama principal, Romance, Antagonista…) y marca en qué escenas aparece.')}</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Escenas con estado, POV y track (metadatos en outline/<guion>.md). */}
      <h2>{t('Escenas')}</h2>
      <table className="table">
        <thead><tr><th>#</th><th>{t('Escena')}</th><th>{t('Estado')}</th><th>POV</th><th>Track</th><th>{t('Personajes')}</th><th>{t('Palabras')}</th></tr></thead>
        <tbody>
          {script.scenes.map((s, i) => {
            const m = meta(s.heading)
            return (
              <tr key={i}>
                <td>{i + 1}</td>
                <td className="link" onClick={() => openScene(scripts, { script: script.path, heading: s.heading })}>{s.heading}</td>
                <td><select value={m.status ?? ''} style={{ color: m.status ? STATUS_COLOR[m.status] : undefined }} onChange={(e) => void writeMeta(script, s.heading, { status: (e.target.value || undefined) as SceneStatus | undefined })}><option value="">—</option>{SCENE_STATUS.map((st) => <option key={st} value={st}>{t(STATUS_LABEL[st])}</option>)}</select></td>
                <td><select value={m.pov ?? ''} onChange={(e) => void writeMeta(script, s.heading, { pov: e.target.value })}><option value="">—</option>{[...new Set([...s.characters, ...chars])].map((c) => <option key={c} value={c}>{c}</option>)}</select></td>
                <td><select value={m.track ?? ''} onChange={(e) => void writeMeta(script, s.heading, { track: e.target.value })}><option value="">—</option>{planning.tracks.map((tr) => <option key={tr.id} value={tr.id}>{tr.name}</option>)}</select></td>
                <td className="tiny muted">{s.characters.join(', ')}</td>
                <td className="tiny muted">{s.wordCount}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </main>
  )
}
