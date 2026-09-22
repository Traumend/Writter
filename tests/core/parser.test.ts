import { expect, test } from 'vitest'
import { characterName, extractLinks, parseFountain } from '../../src/core/parser/fountain'
import { project } from '../../src/core/projection'
import { validateTags } from '../../src/core/tags'

const SAMPLE = `---
type: script
id: ep01
locked: false
---

INT. DOJO - NOCHE

Un farol tiembla. [[Arata]] envaina la [[Katana de Arata]].

ARATA
(en voz baja)
No otra vez.

%% nota: revisar ritmo %%

CUT TO:

EXT. CALLE - DÍA

YUKI (V.O.)
Vuelve.
`

test('parser determinista y tipos correctos', () => {
  const a = parseFountain(SAMPLE)
  const b = parseFountain(SAMPLE)
  expect(a).toEqual(b)
  expect(a.frontmatter).toEqual({ type: 'script', id: 'ep01', locked: false })
  const types = a.tokens.filter((t) => t.type !== 'blank').map((t) => t.type)
  expect(types).toEqual([
    'frontmatter', 'frontmatter', 'frontmatter', 'frontmatter', 'frontmatter',
    'heading', 'action', 'character', 'parenthetical', 'dialogue', 'note', 'transition', 'heading', 'character', 'dialogue'
  ])
})

test('proyección: escenas, personajes y enlaces', () => {
  const p = project(parseFountain(SAMPLE))
  expect(p.scenes.map((s) => s.heading)).toEqual(['INT. DOJO - NOCHE', 'EXT. CALLE - DÍA'])
  expect(p.scenes[0]?.characters).toEqual(['ARATA'])
  expect(p.scenes[0]?.links).toEqual(['Arata', 'Katana de Arata'])
  expect(p.characters).toEqual(['ARATA', 'YUKI'])
  expect(characterName('@RICK (V.O.) ^')).toBe('RICK')
  expect(extractLinks('a [[X|alias]] y [[Y#sec]]')).toEqual(['X', 'Y'])
})

test('validador de tags', () => {
  expect(validateTags({ entity_link: '[[ ]]', note: '%% %%' })).toEqual([])
  expect(validateTags({ entity_link: '[[ ]]', note: '[[ ]]' }).some((i) => i.level === 'error')).toBe(true)
  expect(validateTags({ entity_link: '[[ ]]', note: '# #' }).some((i) => i.level === 'warn')).toBe(true)
})

// Prosa (novela/capítulo) sin encabezados Fountain: las secciones Markdown más profundas actúan como escenas.
const PROSE = `## Preludio 0.1 — Los diez

### La profecía

En 1512 la vidente [[Alessandra]] dictó el decálogo.

### El rey

[[Aetios]] abandonó su corona.
`

test('proyección: prosa con secciones # como escenas de respaldo', () => {
  const p = project(parseFountain(PROSE))
  expect(p.scenes.map((s) => [s.heading, s.group])).toEqual([['La profecía', 'Preludio 0.1 — Los diez'], ['El rey', 'Preludio 0.1 — Los diez']])
  expect(p.scenes[1]?.links).toEqual(['Aetios'])
  expect(p.scenes[0]?.wordCount).toBe(8)
  // Un solo nivel: cada sección es una escena, sin grupo.
  expect(project(parseFountain('## A\n\nx\n\n## B\n\ny\n')).scenes.map((s) => [s.heading, s.group])).toEqual([['A', ''], ['B', '']])
  // Con encabezados Fountain las secciones siguen siendo grupos (sin cambios).
  expect(project(parseFountain(SAMPLE)).scenes).toHaveLength(2)
})
