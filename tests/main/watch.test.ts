import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import * as V from '../../src/main/vault'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// El watcher del vault debe avisar de cambios externos (creación y modificación en sitio), también desde otro proceso.
test('watcher: creación, modificación en sitio y escritura desde otro proceso disparan onChange', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'writter-watch-'))
  const seen: string[] = []
  V.openVault(dir, (e) => seen.push(e.path))
  const rel = 'entities/characters/10 Cruzados Santos/Aetios.md'
  mkdirSync(join(dir, 'entities/characters/10 Cruzados Santos'), { recursive: true })
  await sleep(300)
  writeFileSync(join(dir, rel), '---\naliases: []\n---\n')
  await sleep(800)
  expect(seen.filter((p) => p === rel).length).toBeGreaterThan(0)
  seen.length = 0
  writeFileSync(join(dir, rel), '---\naliases: ["Externo"]\n---\n')
  await sleep(800)
  expect(seen.filter((p) => p === rel).length).toBeGreaterThan(0)
  seen.length = 0
  execFileSync('python', ['-c', "import io,sys; io.open(sys.argv[1],'w',encoding='utf-8').write('---\\naliases: [\"Proceso\"]\\n---\\n')", join(dir, rel)])
  await sleep(800)
  expect(seen.filter((p) => p === rel).length).toBeGreaterThan(0)
  try { rmSync(dir, { recursive: true, force: true }) } catch { /* watcher */ }
})

// Un vault anidado (Obsidian abierto antes en una subcarpeta) tiene .narrative/versions/<archivo>.md, que son DIRECTORIOS:
// leerlos como archivo revienta el proceso principal con EISDIR.
test('watcher: ignora carpetas ocultas anidadas y no lee directorios que terminan en .md', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'writter-nested-'))
  const seen: string[] = []
  const crashes: Error[] = []
  const onCrash = (e: Error) => crashes.push(e)
  process.prependListener('uncaughtException', onCrash)
  V.openVault(dir, (e) => seen.push(e.path))
  const versions = join(dir, 'Personajes/.narrative/versions/Josué Sánchez.md')
  mkdirSync(versions, { recursive: true })
  await sleep(500)
  writeFileSync(join(versions, '1758000000.user.md'), 'contenido de una versión')
  await sleep(1200)
  process.removeListener('uncaughtException', onCrash)
  expect(crashes.map((e) => e.message)).toEqual([])
  expect(seen.filter((p) => p.includes('.narrative'))).toEqual([])
  try { rmSync(dir, { recursive: true, force: true }) } catch { /* watcher */ }
})

// Errores del propio observador (EPERM al mover/bloquear la carpeta observada) no deben tumbar el proceso.
test('watcher: un error del observador no lanza excepción no capturada', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'writter-eperm-'))
  const crashes: Error[] = []
  const onCrash = (e: Error) => crashes.push(e)
  process.prependListener('uncaughtException', onCrash)
  V.openVault(dir, () => undefined)
  await sleep(200)
  V.watcherForTest()?.emit('error', Object.assign(new Error('EPERM: operation not permitted, watch'), { code: 'EPERM' }))
  await sleep(300)
  process.removeListener('uncaughtException', onCrash)
  expect(crashes.map((e) => e.message)).toEqual([])
  try { rmSync(dir, { recursive: true, force: true }) } catch { /* watcher */ }
})
