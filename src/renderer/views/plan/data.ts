import { useMemo } from 'react'
import { breakdown, extractMissing } from '../../../core/breakdown'
import { clinic, type Issue } from '../../../core/clinic'
import { readFrontmatter, writeFrontmatter } from '../../../core/frontmatter'
import { sceneMinutes } from '../../../core/paginate'
import { parseFountain } from '../../../core/parser/fountain'
import { PLANNING_PATH, planningTemplate, readArc, readMotivation, readPlanning, readSceneMeta, MOT_DIMS, type Planning, type SceneMeta, type SceneRef } from '../../../core/planning'
import { project, type Scene } from '../../../core/projection'
import { useStore } from '../../store'

// Datos derivados del vault para la capa de planificación (una historia, muchas vistas).
export type ScriptInfo = { path: string; name: string; season: string; episode: string; scenes: Scene[]; minutes: number[]; acts: { title: string; from: number; to: number }[]; beats: { id?: string; title?: string; scene: number; kind?: string; tension?: number; characters?: string[] }[]; outlinePath: string; sceneMeta: Record<string, SceneMeta>; words: number }

export function useScripts(): ScriptInfo[] {
  const { files, docs } = useStore()
  return useMemo(() => files.filter((f) => f.kind === 'script').map((f) => {
    const d = docs.find((x) => x.path === f.path)
    const fm = d ? readFrontmatter(d.content).data : {}
    const doc = parseFountain(d?.content ?? '')
    const p = project(doc)
    const outlinePath = `outline/${f.path.split('/').pop()!}`
    const od = docs.find((x) => x.path === outlinePath)
    const outline = od ? readFrontmatter(od.content).data : {}
    const acts = (outline['acts'] as { title: string; from: number; to: number }[] | undefined) ?? []
    const beats = (outline['beats'] as ScriptInfo['beats'] | undefined) ?? []
    return { path: f.path, name: f.name, season: String(fm['season'] ?? ''), episode: String(fm['episode'] ?? ''), scenes: p.scenes, minutes: sceneMinutes(doc.tokens, p.scenes), acts, beats, outlinePath, sceneMeta: readSceneMeta(od?.content), words: p.wordCount }
  }), [files, docs])
}

export function useCards() {
  const { files, docs } = useStore()
  return useMemo(() => breakdown(files, docs), [files, docs])
}

// Planificación del proyecto (outline/Planning.md): lectura + escritura parcial con creación perezosa del archivo.
export function usePlanning(): { planning: Planning; save: (patch: Partial<Planning>) => Promise<void> } {
  const { docs, files, writeOther, createFile } = useStore()
  const doc = docs.find((d) => d.path === PLANNING_PATH)
  const planning = useMemo(() => readPlanning(doc?.content), [doc?.content])
  const save = async (patch: Partial<Planning>) => {
    if (files.some((f) => f.path === PLANNING_PATH) && doc) await writeOther(PLANNING_PATH, writeFrontmatter(doc.content, patch))
    else await createFile(PLANNING_PATH, writeFrontmatter(planningTemplate(), patch), false)
  }
  return { planning, save }
}

// Escribe metadatos de una escena (track/estado/POV/tags/overrides) en el outline del guion, creándolo si falta.
export function useSceneMetaWriter() {
  const { docs, files, writeOther, createFile } = useStore()
  return async (script: ScriptInfo, heading: string, patch: Partial<SceneMeta>) => {
    const meta = { ...script.sceneMeta, [heading]: { ...(script.sceneMeta[heading] ?? {}), ...patch } }
    const od = docs.find((x) => x.path === script.outlinePath)
    if (od && files.some((f) => f.path === script.outlinePath)) await writeOther(script.outlinePath, writeFrontmatter(od.content, { sceneMeta: meta }))
    else await createFile(script.outlinePath, `---\ntype: outline\ntitle: "${script.name}"\nacts: []\nbeats: []\nnotes: []\nsceneMeta: {}\n---\n\n`.replace('sceneMeta: {}', `sceneMeta: ${JSON.stringify(meta)}`), false)
  }
}

export const refLabel = (r: SceneRef | undefined, scripts: ScriptInfo[]) => {
  if (!r) return '—'
  const s = scripts.find((x) => x.path === r.script)
  const i = s?.scenes.findIndex((x) => x.heading.trim().toUpperCase() === r.heading.trim().toUpperCase()) ?? -1
  return i >= 0 ? `${scripts.length > 1 ? s!.name.slice(0, 8) + ' ' : ''}#${i + 1}` : '?'
}

// Diagnóstico del proyecto: una sola construcción de la entrada de la Clinic para todas las vistas
// (Dashboard y Clinic mostraban distinto si se duplicaba).
export function useClinicIssues(): Issue[] {
  const scripts = useScripts()
  const cards = useCards()
  const { planning } = usePlanning()
  const { files, docs } = useStore()
  const missing = useMemo(() => extractMissing(files, docs), [files, docs])
  return useMemo(() => clinic({
    scripts: scripts.map((s) => ({ path: s.path, name: s.name, scenes: s.scenes.map((x, i) => ({ heading: x.heading, characters: x.characters, wordCount: x.wordCount, minutes: s.minutes[i] ?? 0 })), acts: s.acts, sceneMeta: s.sceneMeta, beats: s.beats })),
    characters: cards.filter((c) => c.kind === 'character').map((c) => {
      const data = readFrontmatter(docs.find((d) => d.path === c.path)?.content ?? '').data
      const arc = readArc(data)
      return {
        name: c.name, group: c.group, appearances: c.appearances.length,
        relationships: ((data['relationships'] as { target: string }[] | undefined) ?? []).map((r) => r.target),
        arcPoints: arc.filter((p) => p.note.trim() || p.ref).length,
        arcLinked: arc.filter((p) => p.ref).length,
        motDims: MOT_DIMS.filter(([k]) => readMotivation(data)[k]?.text.trim()).length
      }
    }),
    locations: cards.filter((c) => c.kind === 'location').map((c) => ({ name: c.name, appearances: c.appearances.length })),
    missing,
    planning
  }), [scripts, cards, planning, docs, missing])
}
