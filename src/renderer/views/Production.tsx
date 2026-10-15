import { useEffect, useState } from 'react'
import { readFrontmatter, writeFrontmatter } from '../../core/frontmatter'
import { t } from '../i18n'
import { cleanErr, useStore } from '../store'
import { Icon, BlurInput, EpisodeSelect, useAsset, useDoc, useProjection } from '../ui'
import { CallSheets } from './prod/CallSheets'
import { Plan } from './prod/Plan'
import { Reports } from './prod/Reports'
import { Team } from './prod/Team'

// Producción (Fase 2, resolución mínima): shot list por escena en assets/shots/<episodio>.md; imagen de storyboard adjunta.
// Varias imágenes por toma (`images`); `image` queda como la primera para compatibilidad.
type Shot = { id: string; scene: number; size: string; angle: string; movement: string; lens: string; description: string; status: string; image: string; images?: string[] }
const imgs = (s: Shot) => s.images ?? (s.image ? [s.image] : [])
const DEFAULT_STYLE = 'boceto de storyboard a lápiz, blanco y negro, encuadre cinematográfico'
const SIZES = ['Plano general', 'Plano medio', 'Primer plano', 'Plano detalle', 'Plano americano', 'Two-shot', 'Over the shoulder']
const ANGLES = ['Normal', 'Picado', 'Contrapicado', 'Cenital', 'Nadir', 'Holandés']
const MOVES = ['Fijo', 'Paneo', 'Tilt', 'Dolly in', 'Dolly out', 'Travelling', 'Steadicam', 'Grúa', 'Cámara en mano']
const STATUS = ['Pendiente', 'Aprobada', 'En rodaje', 'Rodada']
// Notas por departamento (13, como el break-down de dirección de ScriptWriterX), por escena.
const DEPTS: [string, string][] = [
  ['arte', 'Arte'], ['vestuario', 'Vestuario'], ['maquillaje', 'Maquillaje y peinado'], ['sonido', 'Sonido'],
  ['efectos', 'Efectos'], ['vfx', 'VFX'], ['locacion', 'Locación'], ['fotografia', 'Fotografía'],
  ['iluminacion', 'Iluminación'], ['edicion', 'Edición'], ['direccion', 'Dirección de escena'],
  ['rodaje', 'Sugerencias de rodaje'], ['generales', 'Notas generales']
]
const uid = () => Math.random().toString(36).slice(2, 8)

function ProdTabs({ tab, setTab }: { tab: ProdTab; setTab: (t: ProdTab) => void }) {
  return (
    <div className="toolbar wrap prodtabs">
      {PROD_TABS.map(([k, l]) => <button key={k} className={tab === k ? 'mini on' : 'mini ghost'} onClick={() => setTab(k)}>{t(l)}</button>)}
    </div>
  )
}

function Thumb({ rel, onRemove }: { rel: string; onRemove?: () => void }) {
  const url = useAsset(rel)
  return <div className="thumb">{url && <img src={url} alt="" />}{onRemove && <button className="x" title={t('Quitar')} onClick={onRemove}><Icon name="close" size={10} /></button>}</div>
}

// Imágenes de una toma: las que hay, adjuntar del disco y generar con IA.
function Frames({ shot, busy, onChange, onAi }: { shot: Shot; busy: boolean; onChange: (images: string[]) => void; onAi: () => void }) {
  const list = imgs(shot)
  return (
    <div className="frames">
      {list.map((rel, i) => <Thumb key={rel + i} rel={rel} onRemove={() => onChange(list.filter((_, j) => j !== i))} />)}
      <button className="mini ghost" title={t('Adjuntar storyboard')} onClick={() => void window.api.assetPick().then((rel) => rel && onChange([...list, rel]))}><Icon name="plus" size={12} /></button>
      <button className="mini ghost" title={t('Generar imagen con IA')} disabled={busy} onClick={onAi}>{busy ? '…' : '✦'}</button>
    </div>
  )
}

// Tira de la escena: todas las imágenes de sus tomas en orden, con el pie de cada toma.
function Strip({ shots, scene }: { shots: Shot[]; scene: number }) {
  const frames = shots.flatMap((s, i) => imgs(s).map((rel) => ({ rel, cap: `${scene + 1}.${i + 1} · ${t(s.size)}${s.description ? ` · ${s.description}` : ''}` })))
  if (!frames.length) return <p className="muted">{t('Sin imágenes en esta escena: adjúntalas o genéralas en cada toma.')}</p>
  return <div className="strip">{frames.map((f, i) => <figure key={f.rel + i}><Thumb rel={f.rel} /><figcaption className="tiny muted">{f.cap}</figcaption></figure>)}</div>
}

const PROD_TABS: [ProdTab, string][] = [['shots', 'Shot list'], ['notes', 'Notas por departamento'], ['plan', 'Plan de rodaje'], ['calls', 'Llamados'], ['reports', 'Reportes'], ['team', 'Equipo']]
type ProdTab = 'shots' | 'notes' | 'plan' | 'calls' | 'reports' | 'team'

export function Production() {
  const [prodTab, setProdTab] = useState<ProdTab>('shots')
  const { files, docs, createFile, writeOther } = useStore()
  const scripts = files.filter((f) => f.kind === 'script')
  const [ep, setEp] = useState<string | null>(scripts[0]?.path ?? null)
  const script = ep ?? scripts[0]?.path ?? null
  const proj = useProjection(script)
  const shotsPath = script ? `assets/shots/${script.split('/').pop()!}` : null
  const shotsDoc = useDoc(shotsPath)
  const [scene, setScene] = useState(0)
  const [strip, setStrip] = useState(false)
  const [pending, setPending] = useState<{ shot: string; b64?: string; err?: string } | null>(null)


  useEffect(() => {
    if (shotsPath && !files.some((f) => f.path === shotsPath)) void createFile(shotsPath, `---\ntype: shotlist\nshots: []\n---\n`, false)
  }, [shotsPath, files, createFile])

  const shots = (shotsDoc ? (readFrontmatter(shotsDoc.content).data['shots'] as Shot[] | undefined) : undefined) ?? []
  const save = (next: Shot[]) => shotsDoc && void writeOther(shotsDoc.path, writeFrontmatter(shotsDoc.content, { shots: next }))
  const upd = (id: string, p: Partial<Shot>) => save(shots.map((s) => (s.id === id ? { ...s, ...p } : s)))
  const list = shots.filter((s) => s.scene === scene)
  const heading = proj.scenes[scene]?.heading ?? ''
  const adNotes = (shotsDoc ? (readFrontmatter(shotsDoc.content).data['adNotes'] as Record<string, Record<string, string>> | undefined) : undefined) ?? {}
  const notes = adNotes[heading] ?? {}
  const setNote = (k: string, v: string) => shotsDoc && void writeOther(shotsDoc.path, writeFrontmatter(shotsDoc.content, { adNotes: { ...adNotes, [heading]: { ...notes, [k]: v } } }))
  const style = String((shotsDoc ? readFrontmatter(shotsDoc.content).data['style'] : '') || DEFAULT_STYLE)
  const setImages = (id: string, images: string[]) => upd(id, { images, image: images[0] ?? '' })

  // Prompt de la toma: escena, encuadre, acción y la apariencia que ya tienen las fichas de quien aparece
  // (así el personaje se parece de una imagen a otra).
  const promptFor = (s: Shot) => {
    const who = new Set((proj.scenes[scene]?.characters ?? []).map((c) => c.toUpperCase()))
    const looks = files.filter((f) => f.kind === 'character').flatMap((f) => {
      const d = readFrontmatter(docs.find((x) => x.path === f.path)?.content ?? '').data
      const names = [f.name, ...(Array.isArray(d['aliases']) ? (d['aliases'] as unknown[]).map(String) : [])].map((n) => n.toUpperCase())
      const look = [d['appearance'], d['description']].filter(Boolean).map((x) => String(x).replace(/\.+$/, '')).join('. ')
      return names.some((n) => who.has(n)) ? [`${f.name}: ${look || 'sin descripción'}`] : []
    })
    return [`${style}.`, `Escena: ${heading}.`, `Plano: ${s.size}, ángulo ${s.angle}, movimiento ${s.movement}, lente ${s.lens}.`, s.description && `Acción: ${s.description.replace(/\.+$/, '')}.`, looks.length ? `Personajes: ${looks.join(' | ')}.` : ''].filter(Boolean).join(' ')
  }
  const generate = async (s: Shot) => {
    setPending({ shot: s.id })
    try { setPending({ shot: s.id, b64: await window.api.aiImage(promptFor(s)) }) } catch (e) { setPending({ shot: s.id, err: cleanErr(e) }) }
  }
  const accept = async () => {
    const s = shots.find((x) => x.id === pending?.shot)
    if (!s || !pending?.b64) return
    const ep = (script ?? '').split('/').pop()!.replace('.md', '')
    const rel = await window.api.assetWrite('storyboard', `${ep}-${scene + 1}-${list.indexOf(s) + 1}`, pending.b64)
    setImages(s.id, [...imgs(s), rel])
    setPending(null)
  }

  if (prodTab !== 'shots' && prodTab !== 'notes') {
    return (
      <main className="page prod">
        <ProdTabs tab={prodTab} setTab={setProdTab} />
        {prodTab === 'plan' && <Plan />}
        {prodTab === 'calls' && <CallSheets />}
        {prodTab === 'reports' && <Reports />}
        {prodTab === 'team' && <Team />}
      </main>
    )
  }

  return (
    <main className="split two">
      <aside>
        <ProdTabs tab={prodTab} setTab={setProdTab} />
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

          <strong className="ell">{heading || '—'}</strong>
          <span className="grow" />
          {prodTab === 'shots' && <span style={{ minWidth: 260 }} title={t('Estilo del storyboard')}><BlurInput value={style} onCommit={(v) => shotsDoc && void writeOther(shotsDoc.path, writeFrontmatter(shotsDoc.content, { style: v || undefined }))} /></span>}
          {prodTab === 'shots' && <button className={strip ? 'mini on' : 'mini ghost'} onClick={() => setStrip((v) => !v)}>{t('Tira')}</button>}
          {prodTab === 'shots' && <button disabled={!shotsDoc || !proj.scenes.length} onClick={() => save([...shots, { id: uid(), scene, size: SIZES[0]!, angle: ANGLES[0]!, movement: MOVES[0]!, lens: '35mm', description: '', status: STATUS[0]!, image: '' }])} ><Icon name="plus" size={12} />{t('Toma')}</button>}
        </div>
        {prodTab === 'notes' && (
          <div className="grid2">
            {DEPTS.map(([k, label]) => (
              <label className="field" key={k}><span>{t(label)}</span>
                <BlurInput textarea rows={2} value={notes[k] ?? ''} placeholder={t('Sin notas')} onCommit={(v) => setNote(k, v)} />
              </label>
            ))}
          </div>
        )}
        {prodTab === 'shots' && pending && (
          <div className="panelbox proposal">
            <div className="row"><strong className="grow">{t('Imagen propuesta')} · {t('toma')} {scene + 1}.{list.findIndex((x) => x.id === pending.shot) + 1}</strong>
              {pending.b64 && <button className="mini" onClick={() => void accept()}>{t('Aceptar')}</button>}
              {(pending.b64 || pending.err) && <button className="mini ghost" onClick={() => { const s = shots.find((x) => x.id === pending.shot); if (s) void generate(s) }}>{t('Regenerar')}</button>}
              <button className="mini ghost" onClick={() => { if (!pending.b64 && !pending.err) window.api.aiCancel(); setPending(null) }}>{pending.b64 || pending.err ? t('Descartar') : t('Cancelar')}</button>
            </div>
            {pending.err ? <p className="err">{pending.err}</p> : pending.b64 ? <img className="preview" src={`data:image/png;base64,${pending.b64}`} alt="" /> : <p className="muted tiny">{t('Generando…')}</p>}
          </div>
        )}
        {prodTab === 'shots' && strip && <Strip shots={list} scene={scene} />}
        {prodTab === 'shots' && (<>
        <table className="table">
          <thead><tr><th>#</th><th>Storyboard</th><th>{t('Tamaño')}</th><th>{t('Ángulo')}</th><th>{t('Movimiento')}</th><th>{t('Lente')}</th><th>{t('Descripción')}</th><th>{t('Estado')}</th><th /></tr></thead>
          <tbody>
            {list.map((s, i) => (
              <tr key={s.id}>
                <td className="ell">{scene + 1}.{i + 1}</td>
                <td><Frames shot={s} busy={pending?.shot === s.id && !pending.b64 && !pending.err} onChange={(images) => setImages(s.id, images)} onAi={() => void generate(s)} /></td>
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
        </>)}
      </section>
    </main>
  )
}
