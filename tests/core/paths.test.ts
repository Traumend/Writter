import { resolve } from 'node:path'
import { expect, test } from 'vitest'
import { resolveInside } from '../../src/core/vault/paths'

test('resolveInside acepta rutas dentro y rechaza escapes', () => {
  expect(resolveInside('/v', 'scripts/ep01.md')).toBe(resolve('/v/scripts/ep01.md'))
  expect(resolveInside('/v', '.')).toBe(resolve('/v'))
  expect(() => resolveInside('/v', '../otro.md')).toThrow('fuera del vault')
  expect(() => resolveInside('/v', '/etc/passwd')).toThrow('fuera del vault')
})
