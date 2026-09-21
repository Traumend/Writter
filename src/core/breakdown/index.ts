import { readFrontmatter } from '../frontmatter'
import { parseFountain } from '../parser/fountain'
import { project } from '../projection'
import type { FileEntry, FileKind } from '../types/ipc'

// Breakdown (B): apariciones de cada entidad por guión y escena, en todo el vault.
export type Appearance = { script: string; scene: number; heading: string; via: 'cue' | 'link' | 'heading' }
export type EntityCard = {
  path: string
  kind: FileKind
  name: string
  aliases: string[]
  group: string
  actor: string
  description: string
  image: string
  appearances: Appearance[]
  words: number // palabras de diálogo (personajes)
}

export type Doc = { path: string; content: string }

const norm = (s: string) => s.trim().toUpperCase()

export function breakdown(files: FileEntry[], docs: Doc[]): EntityCard[] {
  const content = new Map(docs.map((d) => [d.path, d.content]))
  const cards: EntityCard[] = files
    .filter((f) => f.kind === 'character' || f.kind === 'location' || f.kind === 'prop')
    .map((f) => {
      const fm = readFrontmatter(content.get(f.path) ?? '').data
      const aliases = Array.isArray(fm['aliases']) ? (fm['aliases'] as unknown[]).map(String) : []
      return {
        path: f.path,
        kind: f.kind,
        name: f.name,
        aliases,
        group: String(fm['group'] ?? 'none'),
        actor: String(fm['actor'] ?? ''),
        description: String(fm['description'] ?? ''),
        image: String(fm['image'] ?? ''),
        appearances: [],
        words: 0
      }
    })
  const byName = new Map<string, EntityCard>()
  for (const c of cards) for (const n of [c.name, ...c.aliases]) byName.set(norm(n), c)

  for (const f of files.filter((x) => x.kind === 'script')) {
    const text = content.get(f.path)
    if (!text) continue
    const doc = parseFountain(text)
    const p = project(doc)
    for (const sc of p.scenes) {
      const seen = new Set<EntityCard>()
      const hit = (c: EntityCard | undefined, via: Appearance['via']) => {
        if (c && !seen.has(c)) {
          seen.add(c)
          c.appearances.push({ script: f.path, scene: sc.index, heading: sc.heading, via })
        }
      }
      for (const ch of sc.characters) hit(byName.get(norm(ch)), 'cue')
      for (const l of sc.links) hit(byName.get(norm(l)), 'link')
      const H = norm(sc.heading)
      for (const c of cards) if (c.kind === 'location' && [c.name, ...c.aliases].some((n) => H.includes(norm(n)))) hit(c, 'heading')
    }
    // Palabras de diálogo por personaje
    let cur: EntityCard | undefined
    for (const t of doc.tokens) {
      if (t.type === 'character') cur = byName.get(norm(t.text.replace(/^@/, '').replace(/\s*\(.*\)\s*/g, '').replace(/\^$/, '')))
      else if (t.type === 'dialogue' && cur) cur.words += t.text.trim().split(/\s+/).filter(Boolean).length
      else if (t.type !== 'parenthetical') cur = undefined
    }
  }
  return cards
}

// Extracción (B): nombres de cue y encabezados sin ficha.
export function extractMissing(files: FileEntry[], docs: Doc[]): { characters: string[]; locations: string[] } {
  const known = new Set(files.map((f) => norm(f.name)))
  for (const d of docs) for (const a of (readFrontmatter(d.content).data['aliases'] as unknown[] | undefined) ?? []) known.add(norm(String(a)))
  const characters = new Set<string>()
  const locations = new Set<string>()
  for (const f of files.filter((x) => x.kind === 'script')) {
    const text = docs.find((d) => d.path === f.path)?.content
    if (!text) continue
    const p = project(parseFountain(text))
    for (const c of p.characters) if (!known.has(norm(c))) characters.add(c)
    for (const sc of p.scenes) {
      const loc = sc.heading.replace(/^(INT|EXT|EST|I\/E|INT\.?\/EXT)[.\s]+/i, '').split(/\s+-\s+/)[0]?.trim() ?? ''
      if (loc && !known.has(norm(loc))) locations.add(loc)
    }
  }
  return { characters: [...characters].sort(), locations: [...locations].sort() }
}

export function toCsv(cards: EntityCard[]): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
  const rows = cards.map((c) => [c.kind, c.name, c.group, c.actor, c.aliases.join('; '), String(c.appearances.length), c.appearances.map((a) => `${a.script.split('/').pop()}#${a.scene + 1}`).join('; ')].map(esc).join(','))
  return ['kind,name,group,actor,aliases,scenes,appearances', ...rows].join('\n')
}
