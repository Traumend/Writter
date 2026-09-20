// Secciones flexibles del cuerpo de una ficha (Nivel 2, "+ Añadir elemento").
// El cuerpo del .md se divide en un texto introductorio (biografía) y secciones "## Título".
// Obsidian-native: son encabezados Markdown normales, legibles fuera de la app.
export type Section = { title: string; body: string }

export function splitSections(body: string): { intro: string; sections: Section[] } {
  const lines = body.replace(/^\n+/, '').split('\n')
  const intro: string[] = []
  const sections: Section[] = []
  let cur: Section | null = null
  for (const line of lines) {
    const m = /^##\s+(.*)$/.exec(line)
    if (m) {
      if (cur) sections.push({ title: cur.title, body: cur.body.replace(/\n+$/, '') })
      cur = { title: m[1]!.trim(), body: '' }
    } else if (cur) cur.body += (cur.body ? '\n' : '') + line
    else intro.push(line)
  }
  if (cur) sections.push({ title: cur.title, body: cur.body.replace(/\n+$/, '') })
  return { intro: intro.join('\n').trim(), sections }
}

export function joinSections(intro: string, sections: Section[]): string {
  const parts = [intro.trim()]
  for (const s of sections) parts.push(`## ${s.title}\n${s.body}`.trimEnd())
  return parts.filter(Boolean).join('\n\n') + '\n'
}
