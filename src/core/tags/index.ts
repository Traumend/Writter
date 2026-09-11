// Mapa de tags configurable + validador de colisiones (D3, I6).
export type TagMap = { entity_link: string; note: string }

export type TagIssue = { level: 'error' | 'warn'; message: string }

// "[[ ]]" -> { open: "[[", close: "]]" }
export function splitTag(tag: string): { open: string; close: string } {
  const [open = '', close = ''] = tag.split(/\s+/)
  return { open, close: close || open }
}

const FOUNTAIN_LINE_PREFIXES = ['.', '!', '@', '>', '~', '#', '=']

export function validateTags(tags: TagMap): TagIssue[] {
  const issues: TagIssue[] = []
  const link = splitTag(tags.entity_link)
  const note = splitTag(tags.note)
  if (!link.open || !note.open) issues.push({ level: 'error', message: 'Cada tag necesita al menos un delimitador.' })
  if (link.open === note.open) issues.push({ level: 'error', message: 'entity_link y note usan el mismo delimitador de apertura.' })
  for (const [name, t] of [['entity_link', link], ['note', note]] as const) {
    if (FOUNTAIN_LINE_PREFIXES.includes(t.open[0] ?? '')) issues.push({ level: 'warn', message: `${name}: "${t.open}" colisiona con un prefijo de línea de Fountain.` })
  }
  if (note.open === '[[') issues.push({ level: 'warn', message: 'note usa [[ ]]: Obsidian lo renderiza como enlace y Graphify lo indexa como arista.' })
  if (link.open !== '[[') issues.push({ level: 'warn', message: 'entity_link distinto de [[ ]]: Obsidian y Graphify no reconocerán los enlaces.' })
  return issues
}
