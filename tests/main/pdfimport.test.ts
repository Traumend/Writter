import { expect, test } from 'vitest'
import { pdfToScript } from '../../src/main/pdfimport'
import { parseFountain } from '../../src/core/parser/fountain'
import { project } from '../../src/core/projection'

// PDF mínimo de referencia (una página, cuatro líneas con márgenes de guion).
test('pdfToScript extrae el texto del PDF y lo devuelve como guion utilizable', async () => {
  const { text, pages } = await pdfToScript('tests/fixtures/guion-minimo.pdf')
  expect(pages).toBe(1)
  const p = project(parseFountain(text))
  expect(p.scenes.map((s) => s.heading)).toEqual(['INT. COCINA - NOCHE'])
  expect(p.scenes[0]!.characters).toContain('ANA')
  expect(text).toContain('Ana apaga la luz.') // fragmentos de la misma línea unidos
  expect(text.split('\n')[text.split('\n').indexOf('ANA') + 1]).toBe('No vuelvas a llamar.')
}, 30000)
