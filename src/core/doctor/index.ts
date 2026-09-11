import type { ParsedDoc } from '../parser/fountain'
import type { Projection } from '../projection'

// Script Doctor local (D): heurísticas sin IA, offline (I8).
export type Finding = { level: 'info' | 'warn'; scene?: number; message: string }
export type SceneStat = { index: number; heading: string; dialogue: number; action: number; words: number; characters: number }

export function doctor(doc: ParsedDoc, p: Projection, known: Set<string>): { findings: Finding[]; stats: SceneStat[] } {
  const stats: SceneStat[] = p.scenes.map((s) => ({ index: s.index, heading: s.heading, dialogue: 0, action: 0, words: s.wordCount, characters: s.characters.length }))
  const findings: Finding[] = []
  const sceneAt = (line: number) => p.scenes.findIndex((s) => line >= s.startLine && line < s.endLine)
  let curChar = ''
  let run = 0
  for (const t of doc.tokens) {
    const si = sceneAt(t.line)
    const st = stats[si]
    const w = t.text.trim().split(/\s+/).filter(Boolean).length
    if (t.type === 'dialogue') {
      if (st) st.dialogue += w
      run += w
      if (run > 120) {
        findings.push({ level: 'warn', scene: si, message: `Parlamento de ${curChar} muy largo (${run} palabras); considera cortarlo.` })
        run = -9999
      }
    } else if (t.type === 'action') {
      if (st) st.action += w
    }
    if (t.type === 'character') {
      curChar = t.text.trim()
      run = 0
    } else if (t.type !== 'dialogue' && t.type !== 'parenthetical') run = 0
  }
  const avg = stats.reduce((a, s) => a + s.words, 0) / Math.max(1, stats.length)
  for (const s of stats) {
    if (s.words > avg * 2.5 && s.words > 300) findings.push({ level: 'warn', scene: s.index, message: `Escena muy larga (${s.words} palabras, media ${Math.round(avg)}).` })
    if (s.words < 15) findings.push({ level: 'info', scene: s.index, message: 'Escena casi vacía.' })
    if (s.dialogue === 0 && s.action > 150) findings.push({ level: 'info', scene: s.index, message: 'Bloque largo de acción sin diálogo.' })
  }
  const count = new Map<string, number>()
  for (const s of p.scenes) for (const c of s.characters) count.set(c, (count.get(c) ?? 0) + 1)
  for (const [c, n] of count) if (n === 1 && p.scenes.length > 3) findings.push({ level: 'info', message: `${c} aparece en una sola escena.` })
  for (const l of p.links) if (!known.has(l.toLowerCase())) findings.push({ level: 'warn', message: `[[${l}]] no tiene ficha.` })
  return { findings, stats }
}
