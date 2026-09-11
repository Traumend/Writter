import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, watch, writeFileSync, type FSWatcher } from 'node:fs'
import { basename, join, relative, resolve } from 'node:path'
import { parse, stringify } from 'yaml'
import { DEFAULT_CONFIG, KIND_DIR, type FileEntry, type FileKind, type ProjectConfig, type VaultChange, type VaultSummary, type Version } from '../core/types/ipc'
import { resolveInside } from '../core/vault/paths'

export const sha = (s: string) => createHash('sha256').update(s).digest('hex')

let root: string | null = null
let watcher: FSWatcher | null = null

export const vaultRoot = () => {
  if (!root) throw new Error('Sin vault abierto')
  return root
}
export const inVault = (rel: string) => resolveInside(vaultRoot(), rel)
export const toRel = (abs: string) => relative(vaultRoot(), abs).split('\\').join('/')

export function readConfig(): ProjectConfig {
  const p = join(vaultRoot(), '.narrative/project.yaml')
  if (!existsSync(p)) writeFileSync(p, stringify(DEFAULT_CONFIG))
  return { ...DEFAULT_CONFIG, ...(parse(readFileSync(p, 'utf8')) as Partial<ProjectConfig>) }
}

function kindOf(rel: string): FileKind {
  for (const [k, dir] of Object.entries(KIND_DIR)) if (rel.startsWith(dir + '/')) return k as FileKind
  return 'other'
}

export function listFiles(): FileEntry[] {
  const out: FileEntry[] = []
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue
      const abs = join(dir, e.name)
      if (e.isDirectory()) walk(abs)
      else if (e.name.endsWith('.md')) {
        const rel = toRel(abs)
        out.push({ path: rel, kind: kindOf(rel), name: basename(e.name, '.md') })
      }
    }
  }
  walk(vaultRoot())
  return out.sort((a, b) => a.path.localeCompare(b.path))
}

export function openVault(dir: string, onChange: (e: VaultChange) => void): VaultSummary {
  root = resolve(dir)
  for (const d of [...Object.values(KIND_DIR), 'assets', '.narrative/versions']) mkdirSync(join(root, d), { recursive: true })
  const config = readConfig()
  watcher?.close()
  // ponytail: fs.watch recursivo nativo (Win/mac/Linux>=20); chokidar solo si falla en algún FS.
  watcher = watch(root, { recursive: true }, (_ev, file) => {
    if (!file || !file.toString().endsWith('.md') || file.toString().startsWith('.narrative')) return
    const rel = file.toString().split('\\').join('/')
    const abs = join(root!, rel)
    onChange({ path: rel, hash: existsSync(abs) ? sha(readFileSync(abs, 'utf8')) : null })
  })
  return { root, config, files: listFiles() }
}

export function readFile(rel: string) {
  const content = readFileSync(inVault(rel), 'utf8')
  return { content, hash: sha(content) }
}

// --- Versionado (M4, I7): snapshot del contenido previo antes de cada escritura que cambia el archivo.
const versionsDir = (rel: string) => join(vaultRoot(), '.narrative/versions', rel.replace(/[\\/]/g, '__'))

export function writeFile(rel: string, content: string, expectedHash?: string, origin: Version['origin'] = 'user') {
  const abs = inVault(rel)
  const prev = existsSync(abs) ? readFileSync(abs, 'utf8') : null
  if (prev !== null) {
    const prevHash = sha(prev)
    if (expectedHash && prevHash !== expectedHash) throw new Error('conflict')
    if (prevHash === sha(content)) return { hash: prevHash }
    const dir = versionsDir(rel)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, `${Date.now()}.${origin}.md`), prev)
  }
  writeFileSync(abs, content)
  return { hash: sha(content) }
}

export function createFile(rel: string, content: string) {
  const abs = inVault(rel)
  if (existsSync(abs)) throw new Error('exists')
  mkdirSync(join(abs, '..'), { recursive: true })
  writeFileSync(abs, content)
  return { hash: sha(content) }
}

export function listVersions(rel: string): Version[] {
  const dir = versionsDir(rel)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const [ts = '0', origin = 'user'] = f.split('.')
      return { id: f, ts: Number(ts), bytes: statSync(join(dir, f)).size, origin: origin as Version['origin'] }
    })
    .sort((a, b) => b.ts - a.ts)
}

export function readVersion(rel: string, id: string): string {
  return readFileSync(resolveInside(versionsDir(rel), id), 'utf8')
}
