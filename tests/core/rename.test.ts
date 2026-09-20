import { expect, test } from 'vitest'
import { countEntity, renameEntity, renameInText } from '../../src/core/rename'

test('renameInText conserva mayúsculas y hace palabra completa', () => {
  expect(renameInText('RICK\nHola, Rick. El bricklayer no.', ['Rick'], 'Beth')).toEqual({ content: 'BETH\nHola, Beth. El bricklayer no.', count: 2 })
  expect(renameInText('a [[Rick]] y [[Rick|abuelo]]', ['Rick'], 'Beth').content).toBe('a [[Beth]] y [[Beth|abuelo]]')
})

test('renameEntity con alias, por archivo; countEntity coincide', () => {
  const docs = [
    { path: 'scripts/ep.md', content: 'RICK\nHola.\n\nGRANDPA RICK entra.' },
    { path: 'entities/characters/Rick.md', content: '---\nname: "Rick"\naliases: [GRANDPA RICK]\n---\n' },
    { path: 'otro.md', content: 'nada aqui' }
  ]
  const terms = ['Rick', 'GRANDPA RICK']
  const res = renameEntity(docs, terms, 'Beth')
  expect(res.map((r) => r.path).sort()).toEqual(['entities/characters/Rick.md', 'scripts/ep.md'])
  expect(countEntity(docs, terms).find((c) => c.path === 'scripts/ep.md')!.count).toBe(2)
})
