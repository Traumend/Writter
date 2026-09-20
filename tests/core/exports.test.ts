import { expect, test } from 'vitest'
import { mdToFdx, mdToFountain, mdToTxt } from '../../src/core/convert'
import { mdToDocx, zipStore } from '../../src/core/docx'
import { searchReplace } from '../../src/core/searchreplace'

const EP = `---
type: script
title: "X"
---

INT. BAR - DÍA

RICK entra al bar. Rick pide algo.

RICK
Hola bar.
`

test('mdToTxt / mdToFdx quitan frontmatter y mapean tipos', () => {
  const txt = mdToTxt(EP)
  expect(txt).not.toContain('type: script')
  expect(txt).toContain('INT. BAR - DÍA')
  const fdx = mdToFdx(EP)
  expect(fdx).toContain('<Paragraph Type="Scene Heading"><Text>INT. BAR - DÍA</Text>')
  expect(fdx).toContain('<Paragraph Type="Character"><Text>RICK</Text>')
  expect(fdx).toContain('<Paragraph Type="Dialogue"><Text>Hola bar.</Text>')
})

test('mdToDocx produce un ZIP válido con document.xml', () => {
  const buf = mdToDocx(EP)
  expect(buf[0]).toBe(0x50) // 'P'
  expect(buf[1]).toBe(0x4b) // 'K'
  const s = new TextDecoder().decode(buf)
  expect(s).toContain('word/document.xml')
  expect(s).toContain('INT. BAR - D') // el texto va dentro
})

test('zipStore round-trip de cabeceras', () => {
  const z = zipStore([{ name: 'a.txt', data: new TextEncoder().encode('hola') }])
  expect(z[0]).toBe(0x50)
  expect(new TextDecoder().decode(z)).toContain('a.txt')
})

test('searchReplace: por bloque, palabra completa, conteo', () => {
  const docs = [{ path: 'scripts/ep.md', content: EP }]
  const scripts = new Set(['scripts/ep.md'])
  // solo diálogo, "bar" -> "cantina"
  const only = searchReplace(docs, scripts, { query: 'bar', replace: 'cantina', caseSensitive: false, wholeWord: true, regex: false, blockTypes: ['dialogue'] })
  expect(only.length).toBe(1)
  expect(only[0]!.count).toBe(1)
  expect(only[0]!.content).toContain('Hola cantina.')
  expect(only[0]!.content).toContain('INT. BAR - DÍA') // el encabezado no cambia
  // todos los bloques, "Rick" case-insensitive
  const all = searchReplace(docs, scripts, { query: 'rick', replace: 'MORTY', caseSensitive: false, wholeWord: true, regex: false, blockTypes: null })
  expect(all[0]!.count).toBeGreaterThanOrEqual(3)
  // fuera de scope -> nada
  expect(searchReplace(docs, new Set(['otro.md']), { query: 'bar', replace: 'x', caseSensitive: false, wholeWord: false, regex: false, blockTypes: null }).length).toBe(0)
})
