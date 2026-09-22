import { expect, test } from 'vitest'
import { foldersToRoles, guessByName, guessesToRoleMap, guessRole, roleOf } from '../../src/core/adopt'
import { DEFAULT_CONFIG, type FolderGuess } from '../../src/core/types/ipc'

test('guessByName reconoce nombres en varios idiomas', () => {
  expect(guessByName('Personajes')).toBe('character')
  expect(guessByName('Roteiros')).toBe('script')
  expect(guessByName('imágenes')).toBe('assets')
  expect(guessByName('Utilería')).toBe('prop')
  expect(guessByName('CarpetaRara')).toBe(null)
})

test('guessRole prioriza frontmatter, luego nombre, luego contenido', () => {
  expect(guessRole({ name: 'x', mdCount: 3, imageCount: 0, headingCount: 0, fmTypes: ['character', 'character'] })).toBe('character')
  expect(guessRole({ name: 'Guiones', mdCount: 2, imageCount: 0, headingCount: 0, fmTypes: [] })).toBe('script')
  expect(guessRole({ name: 'rara', mdCount: 0, imageCount: 5, headingCount: 0, fmTypes: [] })).toBe('assets')
  expect(guessRole({ name: 'rara', mdCount: 2, imageCount: 0, headingCount: 2, fmTypes: [] })).toBe('script')
  expect(guessRole({ name: 'rara', mdCount: 1, imageCount: 0, headingCount: 0, fmTypes: [] })).toBe('knowledge')
  expect(guessRole({ name: 'vacia', mdCount: 0, imageCount: 0, headingCount: 0, fmTypes: [] })).toBe('ignore')
})

test('foldersToRoles agrupa por rol, descarta ignore y conserva defaults', () => {
  const folders: FolderGuess[] = [
    { path: 'Guiones', role: 'script', mdCount: 3, imageCount: 0, hint: '' },
    { path: 'Cast', role: 'character', mdCount: 4, imageCount: 0, hint: '' },
    { path: 'Elenco viejo', role: 'character', mdCount: 1, imageCount: 0, hint: '' },
    { path: 'basura', role: 'ignore', mdCount: 2, imageCount: 0, hint: '' }
  ]
  const roles = foldersToRoles(folders)
  expect(roles.script).toEqual(['Guiones'])
  expect(roles.character).toEqual(['Cast', 'Elenco viejo'])
  expect(roles.location).toEqual(DEFAULT_CONFIG.roles.location) // sin mapear -> default
})

test('guessesToRoleMap: una carpeta por rol, detectada o default', () => {
  const folders = [
    { path: 'Guiones', role: 'script' as const, mdCount: 2, imageCount: 0, hint: '' },
    { path: 'Cast', role: 'character' as const, mdCount: 3, imageCount: 0, hint: '' }
  ]
  const map = guessesToRoleMap(folders)
  expect(map.script).toBe('Guiones')
  expect(map.character).toBe('Cast')
  expect(map.location).toBe(DEFAULT_CONFIG.roles.location[0]) // sin detectar -> default
  expect(map.assets).toBe(DEFAULT_CONFIG.roles.assets[0])
})

test('roleOf: gana el prefijo de carpeta más profundo', () => {
  const roles = { ...DEFAULT_CONFIG.roles, character: ['Cast', 'Cast/viejos'], script: ['Guiones'] }
  expect(roleOf('Guiones/ep01.md', roles)).toBe('script')
  expect(roleOf('Cast/rick.md', roles)).toBe('character')
  expect(roleOf('Cast/viejos/x.md', roles)).toBe('character')
  expect(roleOf('otra/x.md', roles)).toBe(null)
})

// Una subcarpeta de una carpeta ya asignada a otro rol no puede proponerse: roleOf daría prioridad al prefijo más profundo
// y sus archivos cambiarían de tipo (capítulos de 'Capitulos/Preludio NEW' dejarían de ser guiones).
test('guessesToRoleMap: ignora candidatas dentro de una carpeta ya asignada', () => {
  const folders = [
    { path: 'Capitulos', role: 'script' as const, mdCount: 2, imageCount: 0, hint: '' },
    { path: 'Capitulos/Preludio NEW', role: 'knowledge' as const, mdCount: 9, imageCount: 0, hint: '' },
    { path: 'Bases', role: 'knowledge' as const, mdCount: 1, imageCount: 0, hint: '' }
  ]
  const map = guessesToRoleMap(folders)
  expect(map.script).toBe('Capitulos')
  expect(map.knowledge).toBe('Bases')
})
