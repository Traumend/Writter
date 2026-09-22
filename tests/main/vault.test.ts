import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, expect, test } from 'vitest'
import * as V from '../../src/main/vault'

// Operaciones de fichero del proceso principal sobre un vault temporal real (sin Electron).
let dir = ''
const changes: { path: string; hash: string | null }[] = []
beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'writter-vault-')) })
afterAll(() => { try { rmSync(dir, { recursive: true, force: true }) } catch { /* watcher en Windows */ } })

test('openVault sobre carpeta vacía crea el layout y siembra contenido de ejemplo', () => {
  const s = V.openVault(dir, (e) => changes.push(e))
  expect(V.hasProject(dir)).toBe(true)
  expect(s.files.some((f) => f.kind === 'script')).toBe(true)
  expect(s.files.some((f) => f.kind === 'character')).toBe(true)
  expect(s.config.roles.script).toEqual(['scripts'])
})

test('listFiles: los .md de assets entran como other (shot lists) y los de fuera del mapa se ignoran', () => {
  mkdirSync(join(dir, 'assets/shots'), { recursive: true })
  writeFileSync(join(dir, 'assets/shots/Ep.md'), '---\ntype: shotlist\nshots: []\n---\n')
  mkdirSync(join(dir, 'Ajeno'), { recursive: true })
  writeFileSync(join(dir, 'Ajeno/nota.md'), 'fuera del mapa')
  const files = V.listFiles()
  expect(files.find((f) => f.path === 'assets/shots/Ep.md')?.kind).toBe('other')
  expect(files.some((f) => f.path.startsWith('Ajeno/'))).toBe(false)
  expect(V.readAll().find((d) => d.path === 'assets/shots/Ep.md')?.content).toContain('shotlist')
})

test('writeFile guarda versión del contenido previo, detecta conflicto y no versiona escrituras idénticas', () => {
  const rel = 'scripts/Prueba.md'
  const { hash } = V.createFile(rel, 'v1')
  expect(() => V.createFile(rel, 'otra')).toThrow('exists')
  expect(V.writeFile(rel, 'v1').hash).toBe(hash) // idéntico: sin versión
  expect(V.listVersions(rel)).toHaveLength(0)
  const w2 = V.writeFile(rel, 'v2', hash)
  expect(V.listVersions(rel)).toHaveLength(1)
  expect(V.readVersion(rel, V.listVersions(rel)[0]!.id)).toBe('v1')
  expect(() => V.writeFile(rel, 'v3', hash)).toThrow('conflict') // hash antiguo
  expect(V.readFile(rel)).toEqual({ content: 'v2', hash: w2.hash })
})

test('renameFile mueve dentro del vault y deleteFile deja un snapshot recuperable', () => {
  V.createFile('entities/characters/Ana.md', '---\nname: Ana\n---\n')
  expect(V.renameFile('entities/characters/Ana.md', 'entities/characters/Ana María.md')).toEqual({ path: 'entities/characters/Ana María.md' })
  expect(() => V.renameFile('entities/characters/Ana.md', 'x.md')).toThrow('no existe')
  V.deleteFile('entities/characters/Ana María.md')
  const vs = V.listVersions('entities/characters/Ana María.md')
  expect(vs).toHaveLength(1)
  expect(vs[0]?.label).toBe('antes de borrar')
  expect(() => V.readFile('entities/characters/Ana María.md')).toThrow()
})

test('las rutas que escapan del vault se rechazan', () => {
  expect(() => V.readFile('../fuera.md')).toThrow()
  expect(() => V.createFile('..\\fuera.md', 'x')).toThrow()
})

test('adopt: mapa de roles propio y carpetas creadas; scanFolder propone roles por nombre', () => {
  const other = mkdtempSync(join(tmpdir(), 'writter-adopt-'))
  mkdirSync(join(other, 'Capitulos'), { recursive: true })
  writeFileSync(join(other, 'Capitulos/1.md'), '## Uno\n\nTexto')
  mkdirSync(join(other, 'Personajes'), { recursive: true })
  writeFileSync(join(other, 'Personajes/Ana.md'), '---\ntype: character\n---\n')
  const guesses = V.scanFolder(other)
  expect(guesses.find((g) => g.path === 'Capitulos')?.role).toBe('script')
  expect(guesses.find((g) => g.path === 'Personajes')?.role).toBe('character')
  const s = V.adopt(other, { script: ['Capitulos'], character: ['Personajes'], location: ['Lugares'], prop: ['Props'], outline: ['outline'], knowledge: ['knowledge'], assets: ['assets'] }, () => undefined)
  expect(s.config.roles.script).toEqual(['Capitulos'])
  expect(s.files.map((f) => [f.path, f.kind])).toEqual([['Capitulos/1.md', 'script'], ['Personajes/Ana.md', 'character']])
  expect(V.folderExists(other, 'Lugares')).toBe(true) // creada por adopt
  expect(readFileSync(join(other, '.narrative/project.yaml'), 'utf8')).toContain('Capitulos')
  try { rmSync(other, { recursive: true, force: true }) } catch { /* watcher */ }
})
