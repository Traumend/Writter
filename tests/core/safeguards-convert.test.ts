import { expect, test } from 'vitest'
import { fdxToMd, fountainToMd, mdToFountain, mdToHtml } from '../../src/core/convert'
import { buildGraph } from '../../src/core/graph'
import { checkSafeguards } from '../../src/core/safeguards'

test('safeguards: locked sin autorización se rechaza (AC-6)', () => {
  expect(checkSafeguards({ locked: true, allowLocked: false, replacement: 'b', target: 'a' }).ok).toBe(false)
  expect(checkSafeguards({ locked: true, allowLocked: true, replacement: 'b', target: 'a' }).ok).toBe(true)
  expect(checkSafeguards({ locked: false, allowLocked: false, replacement: 'b', target: 'a' }).ok).toBe(true)
})

test('fdx -> md conserva escenas y diálogos', () => {
  const fdx = `<?xml version="1.0"?><FinalDraft><Content>
<Paragraph Type="Scene Heading"><Text>Int. Dojo - Noche</Text></Paragraph>
<Paragraph Type="Action"><Text>Un farol tiembla.</Text></Paragraph>
<Paragraph Type="Character"><Text>Arata</Text></Paragraph>
<Paragraph Type="Dialogue"><Text>No otra vez.</Text></Paragraph>
</Content></FinalDraft>`
  const md = fdxToMd(fdx, 'Ep 1')
  expect(md).toContain('INT. DOJO - NOCHE')
  expect(md).toContain('ARATA\nNo otra vez.')
  expect(md.startsWith('---\ntype: script')).toBe(true)
})

test('md <-> fountain y html', () => {
  const md = '---\ntype: script\n---\n\nINT. X - DÍA\n\n%% nota %%\n\nRICK\nHola.\n'
  const f = mdToFountain(md)
  expect(f).not.toContain('type: script')
  expect(f).not.toContain('nota')
  expect(f).toContain('RICK\nHola.')
  expect(fountainToMd(f, 'T')).toContain('INT. X - DÍA')
  expect(mdToHtml(md, 'T')).toContain('<div class="c">RICK</div>')
})

test('grafo determinista: links y apariciones', () => {
  const files = [
    { path: 'scripts/ep01.md', kind: 'script' as const, name: 'ep01' },
    { path: 'entities/characters/Arata.md', kind: 'character' as const, name: 'Arata' }
  ]
  const read = (p: string) => (p === 'scripts/ep01.md' ? 'INT. A - DÍA\n\n[[Arata]] y [[Nadie]].\n\nARATA\nHola.\n' : '---\ntype: character\n---\nBio.')
  const g = buildGraph(files, read)
  expect(g.nodes.map((n) => n.id)).toContain('unresolved:Nadie')
  expect(g.edges).toEqual([
    { source: 'scripts/ep01.md', target: 'entities/characters/Arata.md', kind: 'references' },
    { source: 'scripts/ep01.md', target: 'unresolved:Nadie', kind: 'references' },
    { source: 'scripts/ep01.md', target: 'entities/characters/Arata.md', kind: 'appears' }
  ])
})
