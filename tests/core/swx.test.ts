import { expect, test } from 'vitest'
import { blockType, fountainToHtml, htmlToFountain, presenceFromSwx, safeName, statusFromSwx, statusToSwx, swxToVault, vaultToSwx } from '../../src/core/swx'
import { readFrontmatter } from '../../src/core/frontmatter'
import { breakdown } from '../../src/core/breakdown'
import { parseFountain } from '../../src/core/parser/fountain'
import { project } from '../../src/core/projection'
import { readSceneMeta } from '../../src/core/planning'

const ROLES = { script: 'scripts', character: 'entities/characters', location: 'entities/locations', prop: 'entities/props', knowledge: 'knowledge', outline: 'outline' }

const SCENE_HTML = [
  '<p class="scene-heading">INT. COCINA DE ANA - NOCHE</p>',
  '<p class="action">Ana apaga la luz. El refrigerador zumba.</p>',
  '<p class="character">ANA</p>',
  '<p class="parenthetical">en voz baja</p>',
  '<p class="dialogue">No vuelvas a llamar aqu&iacute;.</p>',
  '<p class="transition">CORTE A</p>',
  '<p class="note">Revisar continuidad del vaso.</p>'
].join('')

test('htmlToFountain traduce los bloques de SWX y pega el diálogo a su personaje', () => {
  const f = htmlToFountain(SCENE_HTML)
  expect(f.split('\n')).toEqual([
    'INT. COCINA DE ANA - NOCHE',
    '',
    'Ana apaga la luz. El refrigerador zumba.',
    '',
    'ANA',
    '(en voz baja)',
    'No vuelvas a llamar aquí.',
    '',
    '> CORTE A',
    '',
    '%% Revisar continuidad del vaso. %%'
  ])
  // Encabezado no estándar: se fuerza con punto para que el parser lo reconozca.
  expect(htmlToFountain('<p class="scene-heading">LA AZOTEA</p>')).toBe('.LA AZOTEA')
  // Contenido sin bloques (importaciones antiguas): se limpia pero no se pierde.
  expect(htmlToFountain('Texto suelto &amp; nada m&aacute;s')).toBe('Texto suelto & nada más')
  expect(blockType('sw-block dialogue selected')).toBe('dialogue')
})

test('ida y vuelta: HTML -> Fountain -> HTML conserva los tipos de bloque', () => {
  const html = fountainToHtml(htmlToFountain(SCENE_HTML))
  const classes = [...html.matchAll(/class="([^"]+)"/g)].map((m) => m[1])
  expect(classes).toEqual(['scene-heading', 'action', 'character', 'parenthetical', 'dialogue', 'transition', 'note'])
  expect(html).toContain('<p class="dialogue">No vuelvas a llamar aquí.</p>')
})

test('estados y presencia se mapean en ambos sentidos, tolerando acentos y sinónimos', () => {
  expect(statusFromSwx('En revisión')).toBe('revision')
  expect(statusFromSwx('terminada')).toBe('final')
  expect(statusFromSwx('En curso')).toBe('draft')
  expect(statusFromSwx('sin estado')).toBeUndefined()
  expect(statusToSwx('final')).toBe('terminada')
  expect(statusToSwx(undefined)).toBe('')
  expect(presenceFromSwx('Habla')).toBe('habla')
  expect(presenceFromSwx('mención')).toBe('mencion')
  expect(presenceFromSwx('nada')).toBeUndefined()
  expect(safeName('T01_E03: Piloto/Final')).toBe('T01_E03- Piloto-Final')
})

const PROJECT = {
  project: { title: 'La Azotea', author: 'Ana R.' },
  seasons: [{ id: 7, number: 1 }],
  episodes: [{ id: 3, seasonId: 7, number: 2, title: 'Piloto' }],
  sceneGroups: [{ id: 'g1', name: 'Acto I' }],
  scenes: [
    { id: 11, episodeId: 3, order: 2000, number: '5A', status: 'En revisión', groupId: 'g1', summary: 'Ana corta el vínculo', content: SCENE_HTML },
    { id: 12, episodeId: 3, order: 1000, number: '5', status: 'Terminada', omitted: true, content: '<p class="scene-heading">EXT. CALLE - DIA</p><p class="action">Beto espera.</p>' }
  ],
  characters: [{ id: 'c1', name: 'ANA', aliases: ['ANITA'], description: 'Protagonista' }],
  locations: [{ id: 'l1', name: 'COCINA DE ANA', address: 'Calle 3' }],
  items: [{ id: 'i1', name: 'REVOLVER' }],
  sceneEntityStatus: [{ sceneId: 11, entityId: 'c1', status: 'Habla' }],
  beats: [{ episodeId: 3, title: 'Detonante', type: 'Giro', sceneIndex: 1, notes: 'Ana decide' }],
  devDocuments: [{ title: 'Sinopsis', content: '<p>Una mujer que cuelga el teléfono.</p>' }],
  mediaBlobs: [{ id: 1 }, { id: 2 }]
}

test('swxToVault crea guion por episodio, escaleta con sceneMeta y fichas de entidad', () => {
  const { files, report } = swxToVault(PROJECT, ROLES)
  const paths = files.map((f) => f.path)
  expect(paths).toContain('scripts/S01E02 Piloto.md')
  expect(paths).toContain('outline/S01E02 Piloto.md')
  expect(paths).toContain('entities/characters/ANA.md')
  expect(paths).toContain('entities/locations/COCINA DE ANA.md')
  expect(paths).toContain('entities/props/REVOLVER.md')
  expect(paths).toContain('knowledge/SWX/Sinopsis.md')

  const script = files.find((f) => f.path === 'scripts/S01E02 Piloto.md')!.content
  const fm = readFrontmatter(script)
  expect([fm.data['season'], fm.data['episode'], fm.data['type']]).toEqual(['1', '2', 'script'])
  // Las escenas salen en el orden de SWX (order), no en el de la lista.
  expect(script.indexOf('EXT. CALLE - DIA')).toBeLessThan(script.indexOf('INT. COCINA DE ANA - NOCHE'))

  const outline = readFrontmatter(files.find((f) => f.path === 'outline/S01E02 Piloto.md')!.content).data
  const meta = outline['sceneMeta'] as Record<string, Record<string, unknown>>
  expect(meta['INT. COCINA DE ANA - NOCHE']).toMatchObject({ status: 'revision', numero: '5A', summary: 'Ana corta el vínculo', tags: ['Acto I'], presencia: { ANA: 'habla' } })
  expect(meta['EXT. CALLE - DIA']).toMatchObject({ status: 'final', omitida: true })
  expect((outline['beats'] as unknown[]).length).toBe(1)

  const ana = readFrontmatter(files.find((f) => f.path === 'entities/characters/ANA.md')!.content).data
  expect([ana['type'], ana['aliases'], ana['description']]).toEqual(['character', ['ANITA'], 'Protagonista'])
  expect(report).toMatchObject({ scripts: 1, scenes: 2, characters: 1, locations: 1, items: 1, beats: 1, docs: 1, media: 2 })
})

test('vaultToSwx devuelve un project.json con escenas en HTML, serie y presencia', () => {
  const script = {
    name: 'S01E02 Piloto', season: '1', episode: '2',
    content: '---\ntype: script\n---\n\nINT. COCINA - NOCHE\n\nAna apaga la luz.\n\nANA\nNo vuelvas.\n\nEXT. CALLE - DIA\n\nBeto espera.\n',
    sceneMeta: { 'INT. COCINA - NOCHE': { numero: '5A', status: 'revision' as const, omitida: false, summary: 'Corta el vínculo', presencia: { ANA: 'habla' as const } } }
  }
  const json = JSON.parse(vaultToSwx('La Azotea', 'Ana R.', [script], [{ kind: 'character' as const, name: 'ANA', content: '---\naliases: ["ANITA"]\ndescription: Protagonista\n---\n\nNotas.\n' }]))
  expect(json.project).toMatchObject({ title: 'La Azotea', author: 'Ana R.', type: 'series' })
  expect(json.seasons).toHaveLength(1)
  expect(json.episodes[0]).toMatchObject({ number: 2, code: 'S01E02' })
  expect(json.scenes).toHaveLength(2)
  expect(json.scenes[0]).toMatchObject({ number: '5A', status: 'en-revision', summary: 'Corta el vínculo', omitted: false })
  expect(json.scenes[0].content).toContain('<p class="scene-heading">INT. COCINA - NOCHE</p>')
  expect(json.scenes[0].content).toContain('<p class="character">ANA</p>')
  expect(json.scenes[1].number).toBe('2')
  expect(json.sceneEntityStatus).toEqual([{ sceneId: 1, entityName: 'ANA', status: 'habla' }])
  expect(json.characters[0]).toMatchObject({ name: 'ANA', aliases: ['ANITA'], description: 'Protagonista', notes: 'Notas.' })
  expect(json.schemaVersion).toBe(41)
})

test('los archivos importados son válidos para el motor de Writter (escenas, personajes, sceneMeta)', () => {
  const { files } = swxToVault(PROJECT, ROLES)
  const script = files.find((f) => f.path.startsWith('scripts/'))!
  const proj = project(parseFountain(script.content))
  expect(proj.scenes.map((s) => s.heading)).toEqual(['EXT. CALLE - DIA', 'INT. COCINA DE ANA - NOCHE'])
  expect(proj.scenes[1]!.characters).toContain('ANA')
  expect(proj.wordCount).toBeGreaterThan(0)

  // El desglose reconoce las fichas y las conecta con el guion.
  const entries = files.map((f) => ({ path: f.path, kind: f.path.includes('/characters/') ? 'character' : f.path.includes('/locations/') ? 'location' : f.path.includes('/props/') ? 'prop' : f.path.startsWith('scripts/') ? 'script' : 'other', name: f.path.split('/').pop()!.replace(/\.md$/, '') }))
  const cards = breakdown(entries as never, files.map((f) => ({ path: f.path, content: f.content })))
  const ana = cards.find((c) => c.name === 'ANA')!
  expect(ana.kind).toBe('character')
  expect(ana.appearances.length).toBeGreaterThan(0)

  // Los metadatos vuelven a leerse con el lector normal de escaleta.
  const meta = readSceneMeta(files.find((f) => f.path.startsWith('outline/'))!.content)
  expect(meta['INT. COCINA DE ANA - NOCHE']?.numero).toBe('5A')
  expect(meta['EXT. CALLE - DIA']?.omitida).toBe(true)
})
