// Planificación narrativa (clean-room): tracks, preguntas dramáticas, plant & payoff, ideas (escenas huérfanas),
// meta de palabras, metadatos por escena y motor de personaje. Todo vive en frontmatter .md (Obsidian-native).
import { readFrontmatter } from '../frontmatter'

export const PLANNING_PATH = 'outline/Planning.md'

export type SceneRef = { script: string; heading: string }
export type Track = { id: string; name: string; color: string }
export type QuestionStatus = 'open' | 'developing' | 'partial' | 'answered' | 'abandoned'
export type Question = { id: string; text: string; category: string; status: QuestionStatus; importance: number; introduced?: SceneRef; resolved?: SceneRef; characters: string[]; notes: string }
export type Plant = { id: string; title: string; type: string; plant?: SceneRef; payoffs: SceneRef[]; characters: string[]; notes: string }
export type Idea = { id: string; title: string; summary: string; characters: string[]; track: string; created: number }
export type Planning = { goal: number; tracks: Track[]; questions: Question[]; plants: Plant[]; ideas: Idea[] }

export type SceneStatus = 'idea' | 'outline' | 'planned' | 'draft' | 'revision' | 'revised' | 'final' | 'cut'
export const SCENE_STATUS: SceneStatus[] = ['idea', 'outline', 'planned', 'draft', 'revision', 'revised', 'final', 'cut']
export const QUESTION_STATUS: QuestionStatus[] = ['open', 'developing', 'partial', 'answered', 'abandoned']
export type SceneMeta = { track?: string; status?: SceneStatus; pov?: string; tags?: string[]; overrides?: Record<string, string> }

export const TRACK_COLORS = ['#4f8cff', '#e8437f', '#3ddc97', '#c47d1a', '#b388ff', '#59c1d6', '#ff8fb1', '#9bd659']
export const uid = () => Math.random().toString(36).slice(2, 9)

export function planningTemplate(): string {
  return `---\ntype: planning\ngoal: 0\ntracks: []\nquestions: []\nplants: []\nideas: []\n---\n\nPlanificación del proyecto: tracks, preguntas dramáticas, plants & payoffs e ideas de escena.\n`
}

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])
const ref = (v: unknown): SceneRef | undefined => (v && typeof v === 'object' && (v as SceneRef).script ? { script: String((v as SceneRef).script), heading: String((v as SceneRef).heading ?? '') } : undefined)

// Lee la planificación con valores por defecto tolerantes (campos desconocidos se ignoran; faltantes se rellenan).
export function readPlanning(content: string | undefined): Planning {
  const d = content ? readFrontmatter(content).data : {}
  return {
    goal: Number(d['goal'] ?? 0) || 0,
    tracks: arr<Partial<Track>>(d['tracks']).map((t, i) => ({ id: String(t.id ?? `t${i}`), name: String(t.name ?? ''), color: String(t.color ?? TRACK_COLORS[i % TRACK_COLORS.length]) })),
    questions: arr<Partial<Question>>(d['questions']).map((q, i) => ({
      id: String(q.id ?? `q${i}`), text: String(q.text ?? ''), category: String(q.category ?? ''), status: (QUESTION_STATUS.includes(q.status as QuestionStatus) ? q.status : 'open') as QuestionStatus,
      importance: Math.max(1, Math.min(3, Number(q.importance ?? 2) || 2)), introduced: ref(q.introduced), resolved: ref(q.resolved), characters: arr<string>(q.characters).map(String), notes: String(q.notes ?? '')
    })),
    plants: arr<Partial<Plant>>(d['plants']).map((p, i) => ({
      id: String(p.id ?? `p${i}`), title: String(p.title ?? ''), type: String(p.type ?? ''), plant: ref(p.plant), payoffs: arr<unknown>(p.payoffs).map(ref).filter((x): x is SceneRef => !!x),
      characters: arr<string>(p.characters).map(String), notes: String(p.notes ?? '')
    })),
    ideas: arr<Partial<Idea>>(d['ideas']).map((x, i) => ({ id: String(x.id ?? `i${i}`), title: String(x.title ?? ''), summary: String(x.summary ?? ''), characters: arr<string>(x.characters).map(String), track: String(x.track ?? ''), created: Number(x.created ?? 0) }))
  }
}

// Metadatos por escena del outline de un guion, indexados por encabezado.
export function readSceneMeta(outlineContent: string | undefined): Record<string, SceneMeta> {
  const d = outlineContent ? readFrontmatter(outlineContent).data : {}
  const m = d['sceneMeta']
  return m && typeof m === 'object' ? (m as Record<string, SceneMeta>) : {}
}

// Resuelve una referencia {script, heading} al índice de escena (null si no existe: dato incompleto para la Clinic).
export function resolveRef(r: SceneRef | undefined, scenes: Map<string, string[]>): number | null {
  if (!r) return null
  const list = scenes.get(r.script)
  if (!list) return null
  const i = list.findIndex((h) => h.trim().toUpperCase() === r.heading.trim().toUpperCase())
  return i >= 0 ? i : null
}

// Motor de personaje: 10 dimensiones motivacionales (modelo propio), texto + intensidad 0-10.
export type MotDim = 'goal' | 'need' | 'fear' | 'belief' | 'wound' | 'desire' | 'value' | 'conflict' | 'pressure' | 'transformation'
export type Motivation = Partial<Record<MotDim, { text: string; level: number }>>
export const MOT_DIMS: [MotDim, string, string][] = [
  ['goal', 'Meta', '¿Qué intenta conseguir?'],
  ['need', 'Necesidad', '¿Qué necesita de verdad, aunque no lo sepa?'],
  ['fear', 'Miedo', '¿Qué intenta evitar a toda costa?'],
  ['belief', 'Creencia', '¿Qué cree sobre el mundo o sobre sí mismo?'],
  ['wound', 'Herida', '¿Qué experiencia pasada lo condiciona?'],
  ['desire', 'Deseo', '¿Qué impulso consciente lo mueve hoy?'],
  ['value', 'Valor', '¿Qué protege por encima de todo?'],
  ['conflict', 'Conflicto interno', '¿Qué contradicción lleva dentro?'],
  ['pressure', 'Presión', '¿Qué fuerzas externas lo empujan?'],
  ['transformation', 'Transformación', '¿Qué cambio necesita para llegar al final?']
]
export function readMotivation(data: Record<string, unknown>): Motivation {
  const m = data['motivation']
  if (!m || typeof m !== 'object') return {}
  const out: Motivation = {}
  for (const [k] of MOT_DIMS) {
    const v = (m as Record<string, unknown>)[k]
    if (v && typeof v === 'object') out[k] = { text: String((v as { text?: unknown }).text ?? ''), level: Math.max(0, Math.min(10, Number((v as { level?: unknown }).level ?? 5) || 0)) }
  }
  return out
}
