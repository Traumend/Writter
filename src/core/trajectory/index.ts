import { readFrontmatter } from '../frontmatter'
import { parseFountain } from '../parser/fountain'
import { PLANNING_PATH, readArc, readPlanning, readSceneMeta, type SceneRef } from '../planning'
import { project } from '../projection'
import type { Doc, FileEntry } from '../types/ipc'

// Contexto de trayectoria: lo que el autor ya decidió para después de la posición actual (arcos,
// pagos, preguntas, escenas planeadas y planes escritos en prosa en las fichas), filtrado a quien
// está en escena. Con esto la IA encamina la escena hacia lo planeado en vez de improvisar.
export type Position = { script: string; scene: number }
export type Trajectory = { text: string; missing: { id: string; title: string }[] }

type Key = [number, number] // [orden del episodio, índice de escena]
const before = (a: Key, b: Key) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1])
const up = (s: string) => s.trim().toUpperCase()
const CHAPTER_REF = /\b(?:cap(?:í|i)tulo|cap\.?|episodio|ep\.?)\s*(\d+)/i
const OPEN = new Set(['idea', 'outline', 'planned'])
const MAX_UPCOMING = 14

export function trajectory(files: FileEntry[], docs: Doc[], pos: Position, outlineDir = 'outline'): Trajectory {
  const content = new Map(docs.map((d) => [d.path, d.content]))
  const num = (v: unknown) => Number(v) || 0
  const eps = files
    .filter((f) => f.kind === 'script')
    .map((f) => {
      const text = content.get(f.path) ?? ''
      const fm = readFrontmatter(text).data
      const outline = content.get(`${outlineDir}/${f.path.split('/').pop()!}`)
      return { f, season: num(fm['season']), episode: num(fm['episode']), scenes: project(parseFountain(text)).scenes, meta: readSceneMeta(outline), summary: String(readFrontmatter(outline ?? '').data['summary'] ?? '') }
    })
    .sort((a, b) => a.season - b.season || a.episode - b.episode || a.f.path.localeCompare(b.f.path))
  const epIdx = eps.findIndex((e) => e.f.path === pos.script)
  if (epIdx < 0) return { text: '', missing: [] }
  const here: Key = [epIdx, pos.scene]
  const cur = eps[epIdx]!
  const label = (k: Key) => { const e = eps[k[0]]!; return `${e.f.name}${e.episode ? ` (cap. ${e.episode})` : ''}, esc. ${k[1] + 1}${e.scenes[k[1]] ? ` ${e.scenes[k[1]]!.heading}` : ''}` }
  const keyOf = (r: SceneRef | undefined): Key | null => {
    if (!r) return null
    const i = eps.findIndex((e) => e.f.path === r.script)
    if (i < 0) return null
    const j = eps[i]!.scenes.findIndex((s) => up(s.heading) === up(r.heading))
    return [i, Math.max(0, j)]
  }

  // Quién está en escena: personajes por diálogo y entidades enlazadas.
  const scene = cur.scenes[pos.scene]
  const present = new Set([...(scene?.characters ?? []), ...(scene?.links ?? [])].map(up))
  const cards = files.filter((f) => f.kind === 'character').map((f) => {
    const text = content.get(f.path) ?? ''
    const { data, body } = readFrontmatter(text)
    const aliases = Array.isArray(data['aliases']) ? (data['aliases'] as unknown[]).map(String) : []
    return { name: f.name, names: [f.name, ...aliases].map(up), data, body }
  })
  const inScene = cards.filter((c) => c.names.some((n) => present.has(n)))
  const touches = (names: string[]) => !names.length || names.some((n) => present.has(up(n)) || inScene.some((c) => c.names.includes(up(n))))

  const facts = inScene.map((c) => {
    const f = (k: string, l: string) => (c.data[k] ? `${l}: ${String(c.data[k])}` : '')
    return [c.name, f('description', 'logline'), f('want', 'quiere'), f('need', 'necesita')].filter(Boolean).join(' · ')
  })
  const upcoming: { k: Key; line: string }[] = []
  const now: string[] = []
  for (const c of inScene) {
    let last: string | null = null
    for (const p of readArc(c.data)) {
      const k = keyOf(p.ref)
      if (!k || !p.note) continue
      if (before(here, k)) upcoming.push({ k, line: `Arco de ${c.name} · ${p.stage}: ${p.note}` })
      else last = `${c.name} está en «${p.stage}»: ${p.note}`
    }
    if (last) now.push(last)
  }
  const planning = readPlanning(content.get(PLANNING_PATH))
  const missing: Trajectory['missing'] = []
  for (const pl of planning.plants) {
    if (!touches(pl.characters)) continue
    const pays = pl.payoffs.map(keyOf).filter((k): k is Key => !!k && before(here, k))
    if (!pays.length) continue
    const sown = keyOf(pl.plant)
    const first = pays.reduce((a, b) => (before(b, a) ? b : a))
    const state = sown && before(sown, first) ? `sembrada en ${label(sown)}` : 'FALTA SEMBRAR antes del pago'
    if (!(sown && before(sown, first))) missing.push({ id: pl.id, title: pl.title })
    upcoming.push({ k: first, line: `Pago planeado «${pl.title}» (${pl.type}): ${pl.notes || '—'} · ${state}` })
  }
  for (const q of planning.questions) {
    const k = keyOf(q.resolved)
    if (k && before(here, k) && q.status !== 'answered' && q.status !== 'abandoned' && touches(q.characters)) upcoming.push({ k, line: `Pregunta que se resuelve: ${q.text}` })
  }
  eps.forEach((e, i) => e.scenes.forEach((s, j) => {
    const m = e.meta[s.heading]
    const k: Key = [i, j]
    if (!m || !before(here, k) || !(OPEN.has(m.status ?? '') || m.purpose)) return
    const what = [m.summary, m.purpose && `propósito: ${m.purpose}`, m.outcome && `resultado: ${m.outcome}`].filter(Boolean).join(' · ')
    if (what) upcoming.push({ k, line: `Escena planeada: ${what}` })
  }))
  upcoming.sort((a, b) => (before(a.k, b.k) ? -1 : before(b.k, a.k) ? 1 : 0))

  // Planes escritos en prosa en la ficha ("en el capítulo 10…"), solo hacia adelante.
  const curEp = cur.episode || epIdx + 1
  const prose = inScene.flatMap((c) => c.body.split(/(?<=[.!?])\s+|\n+/).filter((sent) => { const m = CHAPTER_REF.exec(sent); return m && Number(m[1]) > curEp }).map((sent) => `${c.name}: ${sent.trim()}`))

  const past = [
    ...eps.slice(0, epIdx).filter((e) => e.summary).map((e) => `${e.f.name}: ${e.summary}`),
    ...cur.scenes.slice(0, pos.scene).filter((s) => cur.meta[s.heading]?.summary).map((s) => `esc. ${s.index + 1}: ${cur.meta[s.heading]!.summary}`)
  ]
  const sections: [string, string[]][] = [
    ['POSICIÓN', [label(here)]],
    ['EN ESCENA', facts],
    ['LO QUE YA PASÓ', past.slice(-12)],
    ['DÓNDE ESTÁN LOS ARCOS', now],
    ['LO QUE VIENE (ya planeado por el autor)', upcoming.slice(0, MAX_UPCOMING).map((u) => `${label(u.k)} — ${u.line}`)],
    ['PLANES EN LAS FICHAS', prose],
    ['FALTA SEMBRAR', missing.map((m) => m.title)]
  ]
  const text = sections.filter(([, ls]) => ls.length).map(([h, ls]) => `${h}:\n${ls.map((l) => `- ${l}`).join('\n')}`).join('\n\n')
  return { text, missing }
}
