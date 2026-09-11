import { parse, stringify } from 'yaml'

// Lectura/escritura de frontmatter YAML preservando el cuerpo (I6: YAML válido para Obsidian).
export function readFrontmatter(text: string): { data: Record<string, unknown>; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text)
  if (!m) return { data: {}, body: text }
  let data: Record<string, unknown> = {}
  try {
    data = (parse(m[1] ?? '') as Record<string, unknown>) ?? {}
  } catch {
    data = {}
  }
  return { data, body: text.slice(m[0].length) }
}

export function writeFrontmatter(text: string, patch: Record<string, unknown>): string {
  const { data, body } = readFrontmatter(text)
  const next = { ...data, ...patch }
  for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k]
  return `---\n${stringify(next).trimEnd()}\n---\n${body.startsWith('\n') ? body : '\n' + body}`
}
