import { useMemo } from 'react'
import { breakdown } from '../../../core/breakdown'
import { readFrontmatter, writeFrontmatter } from '../../../core/frontmatter'
import { sceneMinutes } from '../../../core/paginate'
import { parseFountain } from '../../../core/parser/fountain'
import { sceneKey, type CrewMember, type ShootingDay, type ShootingLocation, type TalentMember } from '../../../core/preproduction'
import { project } from '../../../core/projection'
import { useStore } from '../../store'

// Preproducción en el vault: dos archivos legibles en Obsidian con todo en frontmatter. Viven bajo assets/
// (como las shot lists) para entrar en el índice por el rol assets.
export const PLAN_PATH = 'assets/preproduccion/plan-rodaje.md'
export const TEAM_PATH = 'assets/preproduccion/equipo.md'

export type Plan = { days: ShootingDay[] }
export type Team = { crew: CrewMember[]; talent: TalentMember[]; locations: ShootingLocation[] }

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])
export const uid = () => Math.random().toString(36).slice(2, 9)

// Escenas del proyecto con su duración estimada y su reparto, la base de todo el plan.
export type ProdScene = { key: string; script: string; scriptName: string; heading: string; index: number; minutes: number; characters: string[] }

export function useProdScenes(): ProdScene[] {
  const { files, docs } = useStore()
  return useMemo(() => files.filter((f) => f.kind === 'script').flatMap((f) => {
    const doc = parseFountain(docs.find((d) => d.path === f.path)?.content ?? '')
    const p = project(doc)
    const mins = sceneMinutes(doc.tokens, p.scenes)
    return p.scenes.map((s, i) => ({ key: sceneKey(f.path, s.heading), script: f.path, scriptName: f.name, heading: s.heading, index: i, minutes: mins[i] ?? 0, characters: s.characters }))
  }), [files, docs])
}

export const useProdCards = () => {
  const { files, docs } = useStore()
  return useMemo(() => breakdown(files, docs), [files, docs])
}

// Lectura y escritura de un archivo de preproducción (se crea al primer guardado).
function useDoc<T extends object>(path: string, read: (data: Record<string, unknown>) => T, template: string) {
  const { docs, files, writeOther, createFile } = useStore()
  const doc = docs.find((d) => d.path === path)
  const value = useMemo(() => read(doc ? readFrontmatter(doc.content).data : {}), [doc?.content]) // eslint-disable-line react-hooks/exhaustive-deps
  const save = async (patch: Partial<T>) => {
    if (doc && files.some((f) => f.path === path)) await writeOther(path, writeFrontmatter(doc.content, patch))
    else await createFile(path, writeFrontmatter(template, patch), false)
  }
  return { value, save }
}

export const usePlan = () => useDoc<Plan>(PLAN_PATH, (d) => ({ days: arr<ShootingDay>(d['days']) }), '---\ntype: plan\ndays: []\n---\n\nPlan de rodaje: jornadas, escenas y llamados.\n')
export const useTeam = () => useDoc<Team>(TEAM_PATH, (d) => ({ crew: arr<CrewMember>(d['crew']), talent: arr<TalentMember>(d['talent']), locations: arr<ShootingLocation>(d['locations']) }), '---\ntype: equipo\ncrew: []\ntalent: []\nlocations: []\n---\n\nEquipo, talento y locaciones de rodaje.\n')
