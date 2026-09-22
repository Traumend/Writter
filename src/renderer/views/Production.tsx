import { useEffect, useState } from 'react'
import { readFrontmatter, writeFrontmatter } from '../../core/frontmatter'
import { t } from '../i18n'
import { useStore } from '../store'
import { Icon, BlurInput, EpisodeSelect, useAsset, useDoc, useProjection } from '../ui'

// Producción (Fase 2, resolución mínima): shot list por escena en assets/shots/<episodio>.md; imagen de storyboard adjunta.
type Shot = { id: string; scene: number; size: string; angle: string; movement: string; lens: string; description: string; status: string; image: string }
const SIZES = ['Plano general', 'Plano medio', 'Primer plano', 'Plano detalle', 'Plano americano', 'Two-shot', 'Over the shoulder']
const ANGLES = ['Normal', 'Picado', 'Contrapicado', 'Cenital', 'Nadir', 'Holandés']
const MOVES = ['Fijo', 'Paneo', 'Tilt', 'Dolly in', 'Dolly out', 'Travelling', 'Steadicam', 'Grúa', 'Cámara en mano']
const STATUS = ['Pendiente', 'Aprobada', 'En rodaje', 'Rodada']
const uid = () => Math.random().toString(36).slice(2, 8)

function Thumb({ rel, onPick }: { rel: string; onPick: () => void }) {
  const url = useAsset(rel)
  return <div className="thumb" onClick={onPick} title={t('Adjuntar storyboard')}>{url ? <img src={url} alt="" /> : <span className="muted tiny">+ img</span>}</div>
}

export function Production() {
  const { files, createFile, writeOther } = useStore()
  const scripts = files.filter((f) => f.kind === 'script')
  const [ep, setEp] = useState<string | null>(scripts[0]?.path ?? null)
  const script = ep ?? scripts[0]?.path ?? null
  const proj = useProjection(script)
  const shotsPath = script ? `assets/shots/${script.split('/').pop()!}` : null
  const shotsDoc = useDoc(shotsPath)
  const [scene, setScene] = useState(0)

  useEffect(() => {
    if (shotsPath && !files.some((f) => f.path === shotsPath)) void createFile(shotsPath, `---\ntype: shotlist\nshots: []\n---\n`, false)
  }, [shotsPath, files, createFile])

  const shots = (shotsDoc ? (readFrontmatter(shotsDoc.content).data['shots'] as Shot[] | undefined) : undefined) ?? []
  const save = (next: Shot[]) => shotsDoc && void writeOther(shotsDoc.path, writeFrontmatter(shotsDoc.content, { shots: next }))
  const upd = (id: string, p: Partial<Shot>) => save(shots.map((s) => (s.id === id ? { ...s, ...p } : s)))
  const list = shots.filter((s) => s.scene === scene)

  return (
    <main className="split two">
      <aside>
        <EpisodeSelect value={script} onChange={setEp} />
        <h2>{t('Escenas')}</h2>
        <ul>
          {proj.scenes.map((s) => (
            <li key={s.index} className={s.index === scene ? 'active' : ''} onClick={() => setScene(s.index)}>
              <span className="muted">{s.index + 1}.</span> {s.heading} <span className="muted tiny">{shots.filter((x) => x.scene === s.index).length}</span>
            </li>
          ))}
        </ul>
      </aside>
      <section className="scroll">
        <div className="toolbar">
          <strong>{t('Shot list')} · {proj.scenes[scene]?.heading ?? '—'}</strong>
          <span className="grow" />
          <button disabled={!shotsDoc || !proj.scenes.length} onClick={() => save([...shots, { id: uid(), scene, size: SIZES[0]!, angle: ANGLES[0]!, movement: MOVES[0]!, lens: '35mm', description: '', status: STATUS[0]!, image: '' }])}><Icon name="plus" size={12} />{t('Toma')}</button>
        </div>
        <table className="table">
          <thead><tr><th>#</th><th>Storyboard</th><th>{t('Tamaño')}</th><th>{t('Ángulo')}</th><th>{t('Movimiento')}</th><th>{t('Lente')}</th><th>{t('Descripción')}</th><th>{t('Estado')}</th><th /></tr></thead>
          <tbody>
            {list.map((s, i) => (
              <tr key={s.id}>
                <td className="ell">{scene + 1}.{i + 1}</td>
                <td><Thumb rel={s.image} onPick={() => void window.api.assetPick().then((rel) => rel && upd(s.id, { image: rel }))} /></td>
                <td><select value={s.size} onChange={(e) => upd(s.id, { size: e.target.value })}>{SIZES.map((o) => <option key={o} value={o}>{t(o)}</option>)}</select></td>
                <td><select value={s.angle} onChange={(e) => upd(s.id, { angle: e.target.value })}>{ANGLES.map((o) => <option key={o} value={o}>{t(o)}</option>)}</select></td>
                <td><select value={s.movement} onChange={(e) => upd(s.id, { movement: e.target.value })}>{MOVES.map((o) => <option key={o} value={o}>{t(o)}</option>)}</select></td>
                <td><BlurInput value={s.lens} onCommit={(v) => upd(s.id, { lens: v })} /></td>
                <td style={{ minWidth: 220 }}><BlurInput textarea rows={2} value={s.description} onCommit={(v) => upd(s.id, { description: v })} /></td>
                <td><select value={s.status} onChange={(e) => upd(s.id, { status: e.target.value })}>{STATUS.map((o) => <option key={o} value={o}>{t(o)}</option>)}</select></td>
                <td><button className="mini ghost" title={t('Quitar')} onClick={() => save(shots.filter((x) => x.id !== s.id))}><Icon name="close" size={12} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <p className="muted">{t('Sin tomas en esta escena.')}</p>}
      </section>
    </main>
  )
}
