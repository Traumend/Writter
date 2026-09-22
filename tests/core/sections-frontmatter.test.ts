import { expect, test } from 'vitest'
import { readFrontmatter, writeFrontmatter } from '../../src/core/frontmatter'
import { joinSections, splitSections } from '../../src/core/sections'

test('splitSections/joinSections: intro + secciones ## con ida y vuelta estable', () => {
  const body = 'Intro en prosa.\n\n## Historia\nNació en 1512.\n\n## Voz\nSeca.\n'
  const { intro, sections } = splitSections(body)
  expect(intro).toBe('Intro en prosa.')
  expect(sections).toEqual([{ title: 'Historia', body: 'Nació en 1512.' }, { title: 'Voz', body: 'Seca.' }])
  expect(splitSections(joinSections(intro, sections))).toEqual({ intro, sections })
  expect(splitSections('')).toEqual({ intro: '', sections: [] })
})

test('frontmatter: objetos anidados (Planning.md) sobreviven a escribir y leer; CRLF y sin frontmatter', () => {
  const planning = { goal: 90000, tracks: [{ id: 't1', name: 'Romance', color: '#f00' }], questions: [{ id: 'q1', text: '¿Quién?', introduced: { script: 'scripts/a.md', heading: 'INT. X - DÍA' } }] }
  const txt = writeFrontmatter('---\ntype: planning\n---\n\nCuerpo\n', planning)
  const { data, body } = readFrontmatter(txt)
  expect(data['type']).toBe('planning')
  expect(data['tracks']).toEqual(planning.tracks)
  expect(data['questions']).toEqual(planning.questions)
  expect(body).toBe('\nCuerpo\n')
  expect(readFrontmatter('---\r\ntitle: "A"\r\n---\r\nTexto').data['title']).toBe('A')
  expect(readFrontmatter('Sin frontmatter')).toEqual({ data: {}, body: 'Sin frontmatter' })
  // borrar una clave con undefined y crear frontmatter donde no había
  expect(readFrontmatter(writeFrontmatter(txt, { goal: undefined })).data['goal']).toBeUndefined()
  expect(readFrontmatter(writeFrontmatter('Solo cuerpo', { a: 1 }))).toEqual({ data: { a: 1 }, body: '\nSolo cuerpo' })
})
