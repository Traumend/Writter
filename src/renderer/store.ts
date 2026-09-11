import { create } from 'zustand'
import { readFrontmatter } from '../core/frontmatter'
import { paginate, type Pagination } from '../core/paginate'
import { parseFountain } from '../core/parser/fountain'
import { project, type Projection } from '../core/projection'
import { moveScene as moveSceneText } from '../core/scenes'
import type { AiProposal, Doc, FileEntry, GraphStatus, KeyStatus, ProjectConfig, Scope, VaultSummary, Version } from '../core/types/ipc'

export type Proposal = AiProposal & { from: number; to: number; target: string }
export type Tab = 'desk' | 'breakdown' | 'dev' | 'production' | 'settings'
export type DevTab = 'characters' | 'beats' | 'map' | 'analysis'

type State = {
  tab: Tab
  devTab: DevTab
  vault: VaultSummary | null
  files: FileEntry[]
  docs: Doc[] // todo el vault en memoria (breakdown, análisis, alias)
  path: string | null
  text: string
  diskHash: string | null
  dirty: boolean
  conflict: boolean
  externalSeq: number
  projection: Projection
  pagination: Pagination
  frontmatter: Record<string, unknown>
  cursorLine: number
  selection: { from: number; to: number } | null
  keyStatus: KeyStatus | null
  graph: GraphStatus | null
  scope: Scope
  proposal: Proposal | null
  aiBusy: boolean
  aiError: string | null
  versions: Version[]
  status: string
  showTags: boolean
}

type Actions = {
  setTab(t: Tab): void
  setDevTab(t: DevTab): void
  openVault(pre?: VaultSummary): Promise<void>
  refreshFiles(): Promise<void>
  refreshDocs(): Promise<void>
  openFile(path: string, gotoLine?: number): Promise<void>
  setTextFromEditor(text: string): void
  setTextExternal(text: string): void
  setCursor(line: number, sel: { from: number; to: number } | null): void
  save(force?: boolean): Promise<void>
  reloadFromDisk(): Promise<void>
  createFile(path: string, content: string, open?: boolean): Promise<void>
  writeOther(path: string, content: string): Promise<void>
  setScope(s: Scope): void
  runAi(instruction: string, allowLocked: boolean): Promise<void>
  acceptProposal(): Promise<void>
  rejectProposal(): void
  restoreVersion(id: string): Promise<void>
  snapshot(label: string): Promise<void>
  moveScene(from: number, to: number): void
  refreshGraph(build?: boolean): Promise<void>
  saveKey(key: string): Promise<void>
  saveConfig(c: ProjectConfig): Promise<void>
  toggleTags(): void
}

const EMPTY: Projection = { scenes: [], characters: [], links: [], wordCount: 0 }
const NOPAG: Pagination = { pages: 1, pageStarts: [], lineToPage: [] }
let saveTimer: ReturnType<typeof setTimeout> | null = null

export const delims = (v: VaultSummary | null) => {
  const [lo = '[[', lc = ']]'] = (v?.config.tags.entity_link ?? '[[ ]]').split(/\s+/)
  const [no = '%%', nc = '%%'] = (v?.config.tags.note ?? '%% %%').split(/\s+/)
  return { link: [lo, lc] as [string, string], note: [no, nc] as [string, string] }
}

export function reproject(text: string, v: VaultSummary | null) {
  const d = delims(v)
  const doc = parseFountain(text, d.note[0], d.note[1])
  return { projection: project(doc, d.link[0], d.link[1]), frontmatter: doc.frontmatter, pagination: paginate(doc.tokens) }
}

// Nombres de entidad conocidos (nombre + alias) para subrayado y resolución.
export function entityNames(files: FileEntry[], docs: Doc[]): string[] {
  const out = new Set<string>()
  for (const f of files) {
    if (f.kind !== 'character' && f.kind !== 'location' && f.kind !== 'prop') continue
    out.add(f.name)
    const d = docs.find((x) => x.path === f.path)
    const al = d ? readFrontmatter(d.content).data['aliases'] : undefined
    if (Array.isArray(al)) for (const a of al) out.add(String(a))
  }
  return [...out].filter((n) => n.length >= 3)
}

export const useStore = create<State & Actions>((set, get) => ({
  tab: 'desk',
  devTab: 'characters',
  vault: null,
  files: [],
  docs: [],
  path: null,
  text: '',
  diskHash: null,
  dirty: false,
  conflict: false,
  externalSeq: 0,
  projection: EMPTY,
  pagination: NOPAG,
  frontmatter: {},
  cursorLine: 0,
  selection: null,
  keyStatus: null,
  graph: null,
  scope: 'scene',
  proposal: null,
  aiBusy: false,
  aiError: null,
  versions: [],
  status: '',
  showTags: true,

  setTab: (tab) => set({ tab }),
  setDevTab: (devTab) => set({ devTab }),

  async openVault(pre) {
    const v = pre ?? (await window.api.vaultOpen())
    if (!v) return
    set({ vault: v, files: v.files, path: null, text: '', diskHash: null, dirty: false, proposal: null, projection: EMPTY, pagination: NOPAG })
    set({ keyStatus: await window.api.keysStatus(v.config.byok.provider) })
    await get().refreshDocs()
    void get().refreshGraph()
    const first = v.files.find((f) => f.kind === 'script')
    if (first) void get().openFile(first.path)
  },

  async refreshFiles() {
    if (get().vault) set({ files: await window.api.vaultList() })
  },

  async refreshDocs() {
    if (get().vault) set({ docs: await window.api.vaultReadAll() })
  },

  async openFile(path, gotoLine) {
    if (get().dirty) await get().save()
    const { content, hash } = await window.api.fileRead(path)
    const r = reproject(content, get().vault)
    set((s) => ({ path, text: content, diskHash: hash, dirty: false, conflict: false, proposal: null, ...r, externalSeq: s.externalSeq + 1, versions: [], cursorLine: gotoLine ?? 0 }))
    set({ versions: await window.api.versionList(path) })
  },

  setTextFromEditor(text) {
    set({ text, dirty: true, ...reproject(text, get().vault), status: 'Sin guardar' })
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => void get().save(), 800)
  },

  setTextExternal(text) {
    set((s) => ({ text, dirty: true, ...reproject(text, get().vault), externalSeq: s.externalSeq + 1 }))
    void get().save()
  },

  setCursor: (cursorLine, selection) => set({ cursorLine, selection }),

  async save(force = false) {
    const { path, text, diskHash, dirty, conflict } = get()
    if (!path || !dirty || (conflict && !force)) return
    try {
      const { hash } = await window.api.fileWrite(path, text, force ? undefined : (diskHash ?? undefined), 'user')
      set({ diskHash: hash, dirty: false, conflict: false, status: 'Guardado' })
      set({ versions: await window.api.versionList(path) })
      void get().refreshDocs()
    } catch (e) {
      if (String(e).includes('conflict')) set({ conflict: true, status: 'Conflicto: el archivo cambió en disco' })
      else set({ status: `Error al guardar: ${String(e)}` })
    }
  },

  async reloadFromDisk() {
    const p = get().path
    if (p) {
      set({ dirty: false })
      await get().openFile(p)
    }
  },

  async createFile(path, content, open = true) {
    await window.api.fileCreate(path, content)
    await get().refreshFiles()
    await get().refreshDocs()
    if (open) await get().openFile(path)
  },

  // Escritura de un archivo que no es el activo (fichas, outline, shots). Snapshot automático en main.
  async writeOther(path, content) {
    if (path === get().path) {
      get().setTextExternal(content)
      return
    }
    await window.api.fileWrite(path, content, undefined, 'user')
    await get().refreshDocs()
  },

  setScope: (scope) => set({ scope }),

  async runAi(instruction, allowLocked) {
    const s = get()
    if (!s.path || !instruction.trim()) return
    const lines = s.text.split('\n')
    const scene = s.projection.scenes.find((sc) => s.cursorLine >= sc.startLine && s.cursorLine < sc.endLine)
    let from = s.cursorLine
    let to = s.cursorLine + 1
    let context = ''
    if (s.scope === 'range' && s.selection) [from, to] = [s.selection.from, s.selection.to]
    else if (s.scope === 'cursor') {
      from = Math.max(0, s.cursorLine - 3)
      to = Math.min(lines.length, s.cursorLine + 4)
    } else if (s.scope === 'node') {
      while (from > 0 && (lines[from - 1] ?? '').trim() !== '') from--
      while (to < lines.length && (lines[to] ?? '').trim() !== '') to++
    } else if (scene) [from, to] = [scene.startLine, scene.endLine]
    if (s.scope === 'scene' || s.scope === 'cursor' || s.scope === 'node' || s.scope === 'range') {
      context = scene ? `Escena: ${scene.heading}\nPersonajes: ${scene.characters.join(', ')}\nEntidades: ${scene.links.join(', ')}` : ''
    } else {
      // Outline / Full: resumen desde la proyección y el grafo, no concatenación de archivos (AC-5).
      const outline = s.projection.scenes.map((sc, i) => `${i + 1}. ${sc.heading} [${sc.characters.join(', ')}]`).join('\n')
      context = `ESCALETA:\n${outline}`
      if (s.scope === 'full') {
        const g = await window.api.graphGet()
        const byId = new Map(g.nodes.map((n) => [n.id, n.label]))
        const edges = g.edges.map((e) => `${byId.get(e.source) ?? e.source} -${e.kind}-> ${byId.get(e.target) ?? e.target}`).join('\n')
        context += `\n\nGRAFO DEL VAULT (${g.nodes.length} nodos):\n${edges}`
      }
    }
    const target = lines.slice(from, to).join('\n')
    const locked = s.frontmatter['locked'] === true
    set({ aiBusy: true, aiError: null, proposal: null })
    try {
      await get().save()
      const docHash = get().diskHash ?? ''
      const p = await window.api.aiRun({ path: s.path, scope: s.scope, instruction, from, to, target, context, docHash, allowLocked, locked })
      set({ proposal: { ...p, from, to, target } })
    } catch (e) {
      set({ aiError: cleanErr(e) })
    } finally {
      set({ aiBusy: false })
    }
  },

  async acceptProposal() {
    const { proposal, text, diskHash, path } = get()
    if (!proposal || !path) return
    if (proposal.docHash !== diskHash) {
      set({ aiError: 'La propuesta quedó obsoleta: el documento cambió. Vuelve a pedirla.' })
      return
    }
    const lines = text.split('\n')
    lines.splice(proposal.from, proposal.to - proposal.from, ...proposal.replacement.split('\n'))
    const next = lines.join('\n')
    set((s) => ({ text: next, ...reproject(next, get().vault), proposal: null, externalSeq: s.externalSeq + 1, dirty: true }))
    const { hash } = await window.api.fileWrite(path, next, diskHash ?? undefined, 'ai')
    set({ diskHash: hash, dirty: false, status: 'Propuesta aplicada y guardada', versions: await window.api.versionList(path) })
  },

  rejectProposal: () => set({ proposal: null }),

  async restoreVersion(id) {
    const { path } = get()
    if (!path) return
    const content = await window.api.versionRead(path, id)
    set((s) => ({ text: content, ...reproject(content, get().vault), externalSeq: s.externalSeq + 1, dirty: true }))
    await get().save(true)
  },

  async snapshot(label) {
    const { path } = get()
    if (!path) return
    await get().save()
    set({ versions: await window.api.versionSnapshot(path, label), status: `Snapshot "${label}" creado` })
  },

  moveScene(from, to) {
    const s = get()
    const next = moveSceneText(s.text, s.projection.scenes, from, to)
    if (next !== s.text) get().setTextExternal(next)
  },

  async refreshGraph(build = false) {
    if (!get().vault) return
    set({ graph: build ? await window.api.graphBuild() : await window.api.graphStatus() })
  },

  async saveKey(key) {
    const v = get().vault
    if (!v || !key) return
    set({ keyStatus: await window.api.keysSet(v.config.byok.provider, key) })
  },

  async saveConfig(c) {
    const v = get().vault
    if (!v) return
    const config = await window.api.configWrite(c)
    set({ vault: { ...v, config }, keyStatus: await window.api.keysStatus(config.byok.provider), status: 'Ajustes guardados' })
  },

  toggleTags: () => set((s) => ({ showTags: !s.showTags }))
}))

export const cleanErr = (e: unknown) => String(e).replace(/^Error: (Error invoking remote method '[^']+': )?(Error: )?/, '')

window.addEventListener('vault.opened', (e) => void useStore.getState().openVault((e as CustomEvent<VaultSummary>).detail))

// Cambios externos (Obsidian u otro editor): recargar si no hay cambios locales; si los hay, marcar conflicto (I10).
window.api.onVaultChange((e) => {
  const s = useStore.getState()
  void s.refreshFiles()
  void s.refreshDocs()
  if (e.path !== s.path || e.hash === s.diskHash) return
  if (!s.dirty) void s.reloadFromDisk()
  else useStore.setState({ conflict: true, status: 'Conflicto: el archivo cambió en disco' })
})
