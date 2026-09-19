import { expect, test } from 'vitest'
import { readFrontmatter } from '../../src/core/frontmatter'
import { parseFountain } from '../../src/core/parser/fountain'
import { project } from '../../src/core/projection'
import { seedFiles } from '../../src/core/seed'

test('seed: frontmatter válido en cada archivo y guión con escenas + enlaces', () => {
  const files = seedFiles()
  for (const f of files) {
    expect(f.path.endsWith('.md')).toBe(true)
    expect(() => readFrontmatter(f.content)).not.toThrow()
    expect(readFrontmatter(f.content).data['type']).toBeDefined()
  }
  const script = files.find((f) => f.path.startsWith('scripts/'))!
  const p = project(parseFountain(script.content))
  expect(p.scenes.length).toBeGreaterThanOrEqual(3)
  expect(p.characters).toContain('PROTAGONISTA')
  expect(p.links).toContain('Objeto clave')

  // El outline coincide con el nombre del guión (para que Beat Timeline lo encuentre).
  const outline = files.find((f) => f.path.startsWith('outline/'))!
  expect(outline.path).toBe(`outline/${script.path.split('/').pop()}`)
  const beats = readFrontmatter(outline.content).data['beats'] as unknown[]
  expect(beats.length).toBeGreaterThanOrEqual(3)
})
