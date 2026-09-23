import { expect, test } from 'vitest'
import { mdToFdx, mdToFountain, mdToTxt } from '../../src/core/convert'
import { mdToDocx, zipStore } from '../../src/core/docx'
import { searchReplace } from '../../src/core/searchreplace'
import { estimateCost, fmtCost } from '../../src/core/ai/prices'

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

test('estimateCost usa precios por millón y no inventa cifras de modelos desconocidos', () => {
  expect(estimateCost('claude-opus-5', 1_000_000, 0)).toBeCloseTo(15, 5)
  expect(estimateCost('claude-sonnet-5', 0, 1_000_000)).toBeCloseTo(15, 5)
  expect(estimateCost('meta-llama/llama-3.1-70b-instruct:free', 500_000, 500_000)).toBe(0)
  expect(estimateCost('modelo-que-no-existe', 1000, 1000)).toBeNull()
  expect(fmtCost(null)).toBe('—')
  expect(fmtCost(0)).toBe('0')
  expect(fmtCost(0.004)).toBe('<$0.01')
  expect(fmtCost(1.5)).toBe('$1.50')
})
