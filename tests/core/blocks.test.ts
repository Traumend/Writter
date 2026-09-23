import { expect, test } from 'vitest'
import { asBlock, cycleBlock, lineType, smartEnter } from '../../src/core/editor/blocks'

test('lineType clasifica con el contexto de la línea anterior', () => {
  expect(lineType('INT. COCINA - NOCHE')).toBe('heading')
  expect(lineType('.LA AZOTEA')).toBe('heading')
  expect(lineType('CORTE A:')).toBe('transition')
  expect(lineType('> FUNDIDO')).toBe('transition')
  expect(lineType('ANA')).toBe('character')
  expect(lineType('@Ana')).toBe('character')
  expect(lineType('No vuelvas.', 'character')).toBe('dialogue')
  expect(lineType('(en voz baja)', 'character')).toBe('parenthetical')
  expect(lineType('Ana apaga la luz.')).toBe('action')
  expect(lineType('# Acto I')).toBe('section')
  expect(lineType('   ')).toBe('blank')
  // Una línea en mayúsculas tras un diálogo sigue siendo diálogo (grito), no un personaje nuevo.
  expect(lineType('¡NO!', 'dialogue')).toBe('dialogue')
})

test('smartEnter pega el diálogo a su personaje y separa el resto', () => {
  expect(smartEnter('character')).toBe('\n')
  expect(smartEnter('parenthetical')).toBe('\n')
  expect(smartEnter('dialogue')).toBe('\n')
  expect(smartEnter('heading')).toBe('\n\n')
  expect(smartEnter('action')).toBe('\n\n')
  expect(smartEnter('transition')).toBe('\n\n')
})

test('cycleBlock recorre acción → encabezado → personaje → acotación → transición', () => {
  const a = cycleBlock('Ana apaga la luz.')
  expect(a).toEqual({ text: '.ANA APAGA LA LUZ.', type: 'heading' })
  const b = cycleBlock(a.text)
  expect(b.type).toBe('character')
  const c = cycleBlock(b.text)
  expect(c).toEqual({ text: '(ANA APAGA LA LUZ.)', type: 'parenthetical' })
  const d = cycleBlock(c.text)
  expect(d.type).toBe('transition')
  expect(cycleBlock(d.text).type).toBe('action')
  // Hacia atrás y conservando la sangría.
  expect(cycleBlock('  Ana entra.', 'blank', -1).type).toBe('transition')
  expect(cycleBlock('  Ana entra.', 'blank', -1).text.startsWith('  ')).toBe(true)
})

test('asBlock respeta lo que ya está bien escrito', () => {
  expect(asBlock('INT. COCINA - NOCHE', 'heading')).toBe('INT. COCINA - NOCHE')
  expect(asBlock('ANA', 'character')).toBe('ANA')
  expect(asBlock('CORTE A:', 'transition')).toBe('CORTE A:')
  expect(asBlock('(en voz baja)', 'parenthetical')).toBe('(en voz baja)')
  expect(asBlock('.LA AZOTEA', 'action')).toBe('LA AZOTEA')
})
