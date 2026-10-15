import { expect, test } from 'vitest'
import { isJunk, pdfToFountain, toLines, type PdfItem } from '../../src/core/import/pdf'
import { parseFountain } from '../../src/core/parser/fountain'
import { project } from '../../src/core/projection'

// Coordenadas al estilo PDF: y crece hacia arriba, x desde el margen izquierdo.
const item = (str: string, x: number, y: number, page = 1): PdfItem => ({ str, x, y, page })

test('isJunk descarta artefactos de paginación y respeta el guion', () => {
  for (const j of ['12', '12.', '(3)', 'CONTINUED:', 'CONTINUADO', 'MORE', "(CONT'D)", '22/09/2026', '*****', 'Página 4', '  ']) expect(isJunk(j), j).toBe(true)
  for (const g of ['INT. COCINA - NOCHE', 'ANA', 'Ana apaga la luz.', '(en voz baja)']) expect(isJunk(g), g).toBe(false)
})

test('toLines junta fragmentos de la misma línea y ordena por lectura', () => {
  const lines = toLines([item('mundo', 130, 700), item('Hola ', 100, 700), item('Segunda', 100, 680), item('Otra página', 100, 700, 2)])
  expect(lines.map((l) => l.text)).toEqual(['Hola mundo', 'Segunda', 'Otra página'])
  expect(lines[0]!.x).toBe(100)
})

test('pdfToFountain reconstruye encabezados, cues, diálogo y acción por márgenes', () => {
  const items = [
    item('INT. COCINA DE ANA - NOCHE', 100, 700),
    item('Ana apaga la luz. El refrigerador zumba.', 100, 680),
    item('ANA', 250, 650),
    item('(en voz baja)', 210, 635),
    item('No vuelvas a llamar aquí.', 180, 620),
    item('Beto la mira desde la puerta.', 100, 595),
    item('CORTE A:', 400, 570),
    item('7.', 520, 740), // número de página: se descarta
    item('EXT. CALLE - DÍA', 100, 545)
  ]
  const f = pdfToFountain(items)
  expect(f).toContain('INT. COCINA DE ANA - NOCHE')
  expect(f).toContain('CORTE A:')
  // El resultado se parsea como guion real: dos escenas y ANA como personaje.
  const p = project(parseFountain(f))
  expect(p.scenes.map((s) => s.heading)).toEqual(['INT. COCINA DE ANA - NOCHE', 'EXT. CALLE - DÍA'])
  expect(p.scenes[0]!.characters).toContain('ANA')
  // El diálogo queda pegado a su personaje (sin línea en blanco entre medias).
  const lines = f.split('\n')
  const i = lines.indexOf('ANA')
  expect(lines[i + 1]).toBe('(en voz baja)')
  expect(lines[i + 2]).toBe('No vuelvas a llamar aquí.')
  expect(pdfToFountain([])).toBe('')
})
