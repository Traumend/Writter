import { characterName, extractLinks, type ParsedDoc } from '../parser/fountain'

// Proyección de nodos: tokens + frontmatter + [[links]] -> escenas con entidades presentes (AC-2, I9).
export type Scene = {
  index: number
  heading: string
  startLine: number
  endLine: number // exclusiva
  characters: string[]
  links: string[]
  wordCount: number
  group: string // sección Fountain (`# Acto`) que precede a la escena; '' = sin grupo
}

export type Projection = { scenes: Scene[]; characters: string[]; links: string[]; wordCount: number }

export function project(doc: ParsedDoc, linkOpen = '[[', linkClose = ']]'): Projection {
  const scenes: Scene[] = []
  const allChars = new Set<string>()
  const allLinks = new Set<string>()
  let words = 0
  let cur: Scene | null = null
  let section = '' // grupo actual (última sección `#` vista)
  const chars = new Set<string>()
  const links = new Set<string>()
  // Prosa (novela/capítulo) sin encabezados Fountain: las secciones Markdown más profundas actúan como escenas
  // y las menos profundas como grupo. Con al menos un encabezado Fountain, las secciones siguen siendo solo grupos.
  const depth = (t: string) => /^#+/.exec(t.trim())?.[0].length ?? 0
  const sceneLevel = doc.tokens.some((tk) => tk.type === 'heading') ? 0 : Math.max(0, ...doc.tokens.filter((tk) => tk.type === 'section').map((tk) => depth(tk.text)))

  const flush = (endLine: number) => {
    if (!cur) return
    cur.endLine = endLine
    cur.characters = [...chars].sort()
    cur.links = [...links].sort()
    scenes.push(cur)
    chars.clear()
    links.clear()
  }

  for (const tk of doc.tokens) {
    if (tk.type === 'frontmatter' || tk.type === 'blank') continue
    const asScene = tk.type === 'heading' || (tk.type === 'section' && depth(tk.text) === sceneLevel)
    if (tk.type === 'section' && !asScene) section = tk.text.replace(/^#+\s*/, '').trim()
    if (asScene) {
      flush(tk.line)
      cur = { index: scenes.length, heading: tk.text.trim().replace(/^(\.|#+\s*)/, ''), startLine: tk.line, endLine: tk.line, characters: [], links: [], wordCount: 0, group: section }
    }
    if (tk.type === 'character') {
      const n = characterName(tk.text)
      chars.add(n)
      allChars.add(n)
    }
    for (const l of extractLinks(tk.text, linkOpen, linkClose)) {
      links.add(l)
      allLinks.add(l)
    }
    if (tk.type !== 'note' && tk.type !== 'section' && tk.type !== 'synopsis') {
      const w = tk.text.trim().split(/\s+/).filter(Boolean).length
      words += w
      if (cur) cur.wordCount += w
    }
  }
  flush(doc.tokens.length)
  return { scenes, characters: [...allChars].sort(), links: [...allLinks].sort(), wordCount: words }
}
