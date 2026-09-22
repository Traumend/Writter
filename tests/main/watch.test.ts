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
