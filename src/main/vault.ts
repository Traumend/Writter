import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, watch, writeFileSync, type FSWatcher } from 'node:fs'
import { basename, extname, join, relative, resolve } from 'node:path'
import { parse, stringify } from 'yaml'
import { guessRole, roleOf } from '../core/adopt'
import { DEFAULT_CONFIG, KIND_DIR, type AdoptRole, type Doc, type FileEntry, type FolderGuess, type ProjectConfig, type VaultChange, type VaultSummary, type Version } from '../core/types/ipc'
import { resolveInside } from '../core/vault/paths'

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'])

export const sha = (s: string) => createHash('sha256').update(s).digest('hex')

let root: string | null = null
let watcher: FSWatcher | null = null

export const vaultRoot = () => {
  if (!root) throw new Error('Sin vault abierto')
  return root
}
export const inVault = (rel: string) => resolveInside(vaultRoot(), rel)
export const toRel = (abs: string) => relative(vaultRoot(), abs).split('\\').join('/')

const cfgPath = () => join(vaultRoot(), '.narrative/project.yaml')

export function readConfig(): ProjectConfig {
  if (!existsSync(cfgPath())) writeFileSync(cfgPath(), stringify(DEFAULT_CONFIG))
  const c = (parse(readFileSync(cfgPath(), 'utf8')) as Partial<ProjectConfig>) ?? {}
  // Mezcla superficial por sección para que claves nuevas tengan default.
  return {
    format: { ...DEFAULT_CONFIG.format, ...c.format },
    tags: { ...DEFAULT_CONFIG.tags, ...c.tags },
    graphify: { ...DEFAULT_CONFIG.graphify, ...c.graphify },
    byok: { ...DEFAULT_CONFIG.byok, ...c.byok },
    prompts: { ...DEFAULT_CONFIG.prompts, ...c.prompts },
    cover: { ...DEFAULT_CONFIG.cover, ...c.cover },
    pdf: { ...DEFAULT_CONFIG.pdf, ...c.pdf },
    roles: { ...DEFAULT_CONFIG.roles, ...c.roles }
  }
}

export function writeConfig(c: ProjectConfig): ProjectConfig {
  writeFileSync(cfgPath(), stringify(c))
  return readConfig()
}

export function listFiles(): FileEntry[] {
  const roles = readConfig().roles
  const out: FileEntry[] = []
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue
      const abs = join(dir, e.name)
      if (e.isDirectory()) walk(abs)
      else if (e.name.endsWith('.md')) {
        const rel = toRel(abs)
        const role = roleOf(rel, roles) // null (fuera del mapa) o 'assets' -> se ignora en la lista de contenido
        if (role && role !== 'assets') out.push({ path: rel, kind: role, name: basename(e.name, '.md') })
      }
    }
  }
  walk(vaultRoot())
  return out.sort((a, b) => a.path.localeCompare(b.path))
}

// Escaneo de solo lectura para el asistente de adopción: una fila por carpeta con contenido, con rol propuesto.
export function scanFolder(dir: string): FolderGuess[] {
  const base = resolve(dir)
  type Acc = { md: string[]; images: number; headings: number; fmTypes: string[] }
  const byDir = new Map<string, Acc>()
  const acc = (rel: string): Acc => {
    let a = byDir.get(rel)
    if (!a) byDir.set(rel, (a = { md: [], images: 0, headings: 0, fmTypes: [] }))
    return a
  }
  const walk = (abs: string) => {
    for (const e of readdirSync(abs, { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue
      const child = join(abs, e.name)
      if (e.isDirectory()) walk(child)
      else {
        const rel = relative(base, abs).split('\\').join('/') || '.'
        const a = acc(rel)
        const ext = extname(e.name).toLowerCase()
        if (ext === '.md') {
          a.md.push(e.name)
          if (a.md.length <= 5) {
            const text = readFileSync(child, 'utf8')
            if (/^\s*(INT|EXT|EST|I\/E)[.\s]/im.test(text)) a.headings++
            const m = /^---\r?\n[\s\S]*?\btype:\s*([\w-]+)/m.exec(text)
            if (m?.[1]) a.fmTypes.push(m[1])
          }
        } else if (IMAGE_EXT.has(ext)) a.images++
      }
    }
  }
  walk(base)
  return [...byDir.entries()]
    .filter(([, a]) => a.md.length > 0 || a.images > 0)
    .map(([path, a]) => {
      const name = path === '.' ? basename(base) : (path.split('/').pop() ?? path)
      const role = guessRole({ name, mdCount: a.md.length, imageCount: a.images, headingCount: a.headings, fmTypes: a.fmTypes })
      const hint = a.md.length ? `${a.md.length} .md${a.images ? `, ${a.images} img` : ''}` : `${a.images} img`
      return { path, role, mdCount: a.md.length, imageCount: a.images, hint }
    })
    .sort((x, y) => x.path.localeCompare(y.path))
}


// ponytail: lee todo el vault en memoria para breakdown/análisis; índice incremental si un vault real lo pide.
export function readAll(): Doc[] {
  return listFiles().map((f) => ({ path: f.path, content: readFileSync(inVault(f.path), 'utf8') }))
}

export const hasProject = (dir: string) => existsSync(join(resolve(dir), '.narrative/project.yaml'))

function startWatcher(onChange: (e: VaultChange) => void) {
  watcher?.close()
  // ponytail: fs.watch recursivo nativo (Win/mac/Linux>=20); chokidar solo si falla en algún FS.
  watcher = watch(root!, { recursive: true }, (_ev, file) => {
    if (!file || !file.toString().endsWith('.md') || file.toString().startsWith('.narrative')) return
    const rel = file.toString().split('\\').join('/')
    const abs = join(root!, rel)
    onChange({ path: rel, hash: existsSync(abs) ? sha(readFileSync(abs, 'utf8')) : null })
  })
}

// Abre un proyecto existente, o inicializa el layout por defecto si la carpeta no es un proyecto Writter.
export function openVault(dir: string, onChange: (e: VaultChange) => void): VaultSummary {
  root = resolve(dir)
  const fresh = !existsSync(cfgPath())
  for (const d of ['.narrative/versions', '.narrative/analysis']) mkdirSync(join(root, d), { recursive: true })
  if (fresh) for (const d of [...Object.values(KIND_DIR), 'assets']) mkdirSync(join(root, d), { recursive: true })
  const config = readConfig()
  startWatcher(onChange)
  return { root, config, files: listFiles() }
}

// Adopta una carpeta existente con el mapa rol -> carpetas que confirmó el usuario. No mueve ni crea contenido.
export function adopt(dir: string, roles: Record<AdoptRole, string[]>, onChange: (e: VaultChange) => void): VaultSummary {
  root = resolve(dir)
  for (const d of ['.narrative/versions', '.narrative/analysis']) mkdirSync(join(root, d), { recursive: true })
  const config = writeConfig({ ...readConfig(), roles })
  startWatcher(onChange)
  return { root, config, files: listFiles() }
}

export function readFile(rel: string) {
  const content = readFileSync(inVault(rel), 'utf8')
  return { content, hash: sha(content) }
}

// --- Versionado (M4, I7): snapshot del contenido previo antes de cada escritura que cambia el archivo.
const versionsDir = (rel: string) => join(vaultRoot(), '.narrative/versions', rel.replace(/[\\/]/g, '__'))

function saveVersion(rel: string, content: string, origin: Version['origin'], label = '') {
  const dir = versionsDir(rel)
  mkdirSync(dir, { recursive: true })
  const safe = label.replace(/[^\w\- áéíóúñÁÉÍÓÚÑ]/g, '').slice(0, 40)
  writeFileSync(join(dir, `${Date.now()}.${origin}${safe ? '.' + safe : ''}.md`), content)
}

export function writeFile(rel: string, content: string, expectedHash?: string, origin: Version['origin'] = 'user') {
  const abs = inVault(rel)
  const prev = existsSync(abs) ? readFileSync(abs, 'utf8') : null
  if (prev !== null) {
    const prevHash = sha(prev)
    if (expectedHash && prevHash !== expectedHash) throw new Error('conflict')
    if (prevHash === sha(content)) return { hash: prevHash }
    saveVersion(rel, prev, origin)
  }
  writeFileSync(abs, content)
  return { hash: sha(content) }
}

export function snapshot(rel: string, label: string): Version[] {
  saveVersion(rel, readFileSync(inVault(rel), 'utf8'), 'snapshot', label)
  return listVersions(rel)
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
      const [ts = '0', origin = 'user', ...rest] = f.replace(/\.md$/, '').split('.')
      return { id: f, ts: Number(ts), bytes: statSync(join(dir, f)).size, origin: origin as Version['origin'], label: rest.join('.') || undefined }
    })
    .sort((a, b) => b.ts - a.ts)
}

export function readVersion(rel: string, id: string): string {
  return readFileSync(resolveInside(versionsDir(rel), id), 'utf8')
}

// --- Assets: copia imágenes a assets/ y las sirve como data URL al renderer (que no toca fs).
export function importAsset(src: string): string {
  const name = basename(src)
  const rel = `assets/${name}`
  copyFileSync(src, inVault(rel))
  return rel
}

const MIME: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml' }
export function readAsset(rel: string): string {
  const abs = inVault(rel)
  if (!existsSync(abs)) return ''
  return `data:${MIME[extname(abs).toLowerCase()] ?? 'application/octet-stream'};base64,${readFileSync(abs).toString('base64')}`
}

// --- Análisis IA (D): derivado, en .narrative/analysis/<script>/<ts>.json
const analysisDir = (rel: string) => join(vaultRoot(), '.narrative/analysis', rel.replace(/[\\/]/g, '__'))
export function saveAnalysis(rel: string, data: object): string {
  const dir = analysisDir(rel)
  mkdirSync(dir, { recursive: true })
  const id = `${Date.now()}.json`
  writeFileSync(join(dir, id), JSON.stringify(data, null, 1))
  return id
}
export function listAnalyses(rel: string): { id: string; ts: number }[] {
  const dir = analysisDir(rel)
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => ({ id: f, ts: Number(f.replace('.json', '')) })).sort((a, b) => b.ts - a.ts)
}
export function readAnalysis(rel: string, id: string): unknown {
  return JSON.parse(readFileSync(resolveInside(analysisDir(rel), id), 'utf8'))
}
