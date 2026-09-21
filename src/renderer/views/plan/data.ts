import { useMemo } from 'react'
import { breakdown } from '../../../core/breakdown'
import { readFrontmatter, writeFrontmatter } from '../../../core/frontmatter'
import { sceneMinutes } from '../../../core/paginate'
import { parseFountain } from '../../../core/parser/fountain'
import { PLANNING_PATH, planningTemplate, readPlanning, readSceneMeta, type Planning, type SceneMeta, type SceneRef } from '../../../core/planning'
import { project, type Scene } from '../../../core/projection'
import { useStore } from '../../store'

// Datos derivados del vault para la capa de planificación (una historia, muchas vistas).
export type ScriptInfo = { path: string; name: string; season: string; episode: string; scenes: Scene[]; minutes: number[]; acts: { title: string; from: number; to: number }[]; outlinePath: string; sceneMeta: Record<string, SceneMeta>; words: number }

export function useScripts(): ScriptInfo[] {
  const { files, docs } = useStore()
  return useMemo(() => files.filter((f) => f.kind === 'script').map((f) => {
    const d = docs.find((x) => x.path === f.path)
    const fm = d ? readFrontmatter(d.content).data : {}
    const doc = parseFountain(d?.content ?? '')
    const p = project(doc)
    const outlinePath = `outline/${f.path.split('/').pop()!}`
    const od = docs.find((x) => x.path === outlinePath)
    const acts = od ? ((readFrontmatter(od.content).data['acts'] as { title: string; from: number; to: number }[] | undefined) ?? []) : []
    return { path: f.path, name: f.name, season: String(fm['season'] ?? ''), episode: String(fm['episode'] ?? ''), scenes: p.scenes, minutes: sceneMinutes(doc.tokens, p.scenes), acts, outlinePath, sceneMeta: readSceneMeta(od?.content), words: p.wordCount }
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
