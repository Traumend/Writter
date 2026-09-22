import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { EN } from '../../src/renderer/i18n'

// Comprobaciones estáticas del renderer: lo que no puede fallar en tiempo de compilación pero sí en pantalla.
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) ? [p] : [] })
const src = (p: string) => readFileSync(p, 'utf8')

test("i18n: todo literal t('…') del renderer tiene traducción al inglés", () => {
  const missing = new Set<string>()
  for (const f of walk('src/renderer')) {
    if (f.endsWith('i18n.ts')) continue
    for (const m of src(f).matchAll(/\bt\('((?:[^'\\]|\\.)+)'\)/g)) { const k = m[1]!.replace(/\\'/g, "'"); if (!(k in EN)) missing.add(k) }
  }
  expect([...missing].sort()).toEqual([])
})

test('menú nativo: cada id de comando del menú existe en la tabla COMMANDS del renderer', () => {
  const ids = [...src('src/main/menu.ts').matchAll(/cmd\('([^']+)'/g)].map((m) => m[1]!)
  const table = new Set([...src('src/renderer/commands.ts').matchAll(/^\s+'([a-z]+\.[^']+)': \{/gm)].map((m) => m[1]!))
  expect(ids.filter((id) => !table.has(id))).toEqual([])
})

test('iconos: todo <Icon name="…"> existe en el catálogo', () => {
  const ui = src('src/renderer/ui.tsx')
  const names = new Set([...ui.matchAll(/^\s+([a-z]+): 'M/gm)].map((m) => m[1]!))
  const used = new Set<string>()
  for (const f of walk('src/renderer')) for (const m of src(f).matchAll(/<Icon name="([a-z]+)"/g)) used.add(m[1]!)
  expect([...used].filter((n) => !names.has(n))).toEqual([])
})

test('ningún input de texto escribe en disco en cada pulsación (usar BlurInput)', () => {
  const bad: string[] = []
  for (const f of walk('src/renderer/views')) {
    src(f).split('\n').forEach((ln, i) => {
      if (/<input(?![^>]*type=("?)(range|checkbox|number|radio)\1)[^>]*value=\{[^}]*\}[^>]*onChange=\{\(e\) => (void )?(upd|save|patch|writeMeta)\(/.test(ln)) bad.push(`${f}:${i + 1}`)
    })
  }
  expect(bad).toEqual([])
})

test('sin emojis en el código: los iconos son SVG', () => {
  const emoji = /[\u{1F300}-\u{1FAFF}]/u
  const bad: string[] = []
  for (const f of walk('src')) src(f).split('\n').forEach((ln, i) => { if (emoji.test(ln)) bad.push(`${f}:${i + 1}`) })
  expect(bad).toEqual([])
})

test('las rutas de conocimiento pasan por el mapa de roles (roleDir), no por "knowledge/" fijo', () => {
  const bad: string[] = []
  for (const f of walk('src/renderer/views')) src(f).split('\n').forEach((ln, i) => { if (/`knowledge\//.test(ln)) bad.push(`${f}:${i + 1}`) })
  expect(bad).toEqual([])
})
