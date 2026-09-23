import { useState } from 'react'
import { writeFrontmatter } from '../../core/frontmatter'
import { PLANNING_PATH, planningTemplate, readPlanning, readSceneMeta, type SceneMeta } from '../../core/planning'
import { activeFor, changes, colorOf, nextColor, nextNumber, sceneHashes, type Revision } from '../../core/revisions'
import { t } from '../i18n'
import { useStore } from '../store'
import { TEMPLATE } from './Desk'

// Revisiones por colores (norma de industria, ScriptWriterX §15.2): emitir una revisión congela la
// numeración de las escenas y deja una instantánea con la que se marcan las que cambian después.
export function Revisions() {
  const s = useStore()
  const [motivo, setMotivo] = useState('')
  const planningDoc = s.docs.find((d) => d.path === PLANNING_PATH)
  const planning = readPlanning(planningDoc?.content)
  const script = s.path
  const revs = planning.revisions
  const active = script ? activeFor(revs, script) : undefined
  const now = sceneHashes(s.projection.scenes, s.text)
  const ch = active ? changes(active.base, now) : null

  const outlinePath = script ? `${s.roleDir('outline')}/${script.split('/').pop()!}` : null
  const outlineDoc = s.docs.find((d) => d.path === outlinePath)
  const meta = readSceneMeta(outlineDoc?.content)

  const saveMeta = async (next: Record<string, SceneMeta>) => {
    if (!outlinePath) return
    const name = script!.split('/').pop()!.replace(/\.md$/, '')
    if (outlineDoc) await s.writeOther(outlinePath, writeFrontmatter(outlineDoc.content, { sceneMeta: next }))
    else await s.createFile(outlinePath, writeFrontmatter(TEMPLATE.outline(name), { sceneMeta: next }), false)
  }
  const savePlanning = async (revisions: Revision[]) => {
    if (planningDoc) await s.writeOther(PLANNING_PATH, writeFrontmatter(planningDoc.content, { revisions }))
    else await s.createFile(PLANNING_PATH, writeFrontmatter(planningTemplate(), { revisions }), false)
  }

  // Emitir: congela el número de cada escena y guarda la instantánea del texto actual.
  const emit = async () => {
    if (!script) return
    const frozen: Record<string, SceneMeta> = { ...meta }
    s.projection.scenes.forEach((sc, i) => { frozen[sc.heading] = { ...(frozen[sc.heading] ?? {}), numero: frozen[sc.heading]?.numero ?? String(i + 1) } })
    await saveMeta(frozen)
    const rev: Revision = {
      id: Math.random().toString(36).slice(2, 9),
      numero: revs.length + 1,
      color: nextColor(revs),
      fecha: new Date().toISOString(),
      motivo: motivo.trim(),
      alcance: 'episodio',
      script,
      base: now
    }
    await savePlanning([...revs, rev])
    setMotivo('')
  }

  // Numeración bloqueada: las escenas nuevas reciben sufijo (5A, 5B) según la escena anterior.
  const renumber = async () => {
    const next: Record<string, SceneMeta> = { ...meta }
    const taken = s.projection.scenes.map((sc) => next[sc.heading]?.numero ?? '').filter(Boolean)
    s.projection.scenes.forEach((sc, i) => {
      if (next[sc.heading]?.numero) return
      const prev = i > 0 ? next[s.projection.scenes[i - 1]!.heading]?.numero : undefined
      const num = nextNumber(prev, taken)
      taken.push(num)
      next[sc.heading] = { ...(next[sc.heading] ?? {}), numero: num }
    })
    await saveMeta(next)
  }

  const fmt = (iso: string) => (iso ? new Date(iso).toLocaleDateString() : '')
  const sinNumero = s.projection.scenes.filter((sc) => !meta[sc.heading]?.numero).length

  return (
    <div className="block">
      <h2>{t('Revisiones')}</h2>
      {!script && <p className="muted tiny">{t('Abre un guion para emitir revisiones.')}</p>}
      {script && (
        <>
          {active ? (
            <p className="tiny">
              <span className="cdot" style={{ background: colorOf(active.color) }} /> {t('Revisión activa')} #{active.numero} · {active.color}
              {ch && <> · <b>{ch.modified.length}</b> {t('modificadas')} · <b>{ch.added.length}</b> {t('nuevas')}{ch.removed.length ? <> · <b>{ch.removed.length}</b> {t('desaparecidas')}</> : null}</>}
            </p>
          ) : <p className="muted tiny">{t('Sin revisiones: la numeración es libre y no se marcan cambios.')}</p>}
          <div className="row">
            <input placeholder={t('Motivo (ej. notas del director)')} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            <button onClick={() => void emit()}>{t('Emitir revisión')} {nextColor(revs)}</button>
          </div>
          {active && sinNumero > 0 && (
            <button className="ghost" onClick={() => void renumber()}>{t('Numerar')} {sinNumero} {t('escena(s) nueva(s) con sufijo (5A, 5B…)')}</button>
          )}
          {revs.length > 0 && (
            <ul className="bullets tiny">
              {[...revs].sort((a, b) => b.numero - a.numero).map((r) => (
                <li key={r.id}>
                  <span className="cdot" style={{ background: colorOf(r.color) }} /> #{r.numero} {r.color} · {fmt(r.fecha)}
                  {r.motivo ? ` · ${r.motivo}` : ''} · {r.alcance === 'proyecto' ? t('proyecto') : (r.script ?? '').split('/').pop()?.replace(/\.md$/, '')}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

// Encabezados con cambios desde la revisión activa, para pintar las marcas en la lista de escenas.
export function useRevisionMarks(): { color: string; modified: Set<string>; added: Set<string> } | null {
  const { docs, path, projection, text } = useStore()
  const planning = readPlanning(docs.find((d) => d.path === PLANNING_PATH)?.content)
  const active = path ? activeFor(planning.revisions, path) : undefined
  if (!active) return null
  const ch = changes(active.base, sceneHashes(projection.scenes, text))
  return { color: colorOf(active.color), modified: new Set(ch.modified), added: new Set(ch.added) }
}

// Texto del guion con solo las escenas cambiadas (emisión "solo cambios" del PDF).
export function changedOnly(text: string, scenes: { heading: string; startLine: number; endLine: number }[], marks: { modified: Set<string>; added: Set<string> }): string {
  const lines = text.split('\n')
  const head = lines.slice(0, scenes[0]?.startLine ?? 0)
  const out = [...head]
  for (const sc of scenes) {
    if (!marks.modified.has(sc.heading) && !marks.added.has(sc.heading)) continue
    if (out.length && (out[out.length - 1] ?? '').trim() !== '') out.push('')
    out.push(...lines.slice(sc.startLine, sc.endLine))
  }
  return out.join('\n')
}
