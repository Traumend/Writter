import { create } from 'zustand'
import { parseFountain } from '../core/parser/fountain'
import { project, type Projection } from '../core/projection'
import type { AiProposal, FileEntry, GraphStatus, KeyStatus, Scope, VaultSummary, Version } from '../core/types/ipc'

export type Proposal = AiProposal & { from: number; to: number; target: string }

type State = {
  vault: VaultSummary | null
  files: FileEntry[]
  path: string | null
  text: string
  diskHash: string | null
  dirty: boolean
  conflict: boolean
  externalSeq: number // incrementa cuando el texto cambia fuera del editor (recarga, aceptar IA)
  projection: Projection
  frontmatter: Record<string, unknown>
  cursorLine: number
  selection: { from: number; to: number } | null // líneas [from, to)
  keyStatus: KeyStatus | null
  graph: GraphStatus | null
  scope: Scope
  proposal: Proposal | null
  aiBusy: boolean
  aiError: string | null
  versions: Version[]
  status: string
}

type Actions = {
  openVault(pre?: VaultSummary): Promise<void>
  refreshFiles(): Promise<void>
  openFile(path: string): Promise<void>
  setTextFromEditor(text: string): void
  setCursor(line: number, sel: { from: number; to: number } | null): void
  save(force?: boolean): Promise<void>
  reloadFromDisk(): Promise<void>
  createFile(path: string, content: string): Promise<void>
  setScope(s: Scope): void
  runAi(instruction: string, allowLocked: boolean): Promise<void>
  acceptProposal(): Promise<void>
  rejectProposal(): void
  restoreVersion(id: string): Promise<void>
  refreshGraph(build?: boolean): Promise<void>
  saveKey(key: string): Promise<void>
}

const EMPTY: Projection = { scenes: [], characters: [], links: [], wordCount: 0 }
let saveTimer: ReturnType<typeof setTimeout> | null = null

const linkDelims = (v: VaultSummary | null) => {
  const [o = '[[', c = ']]'] = (v?.config.tags.entity_link ?? '[[ ]]').split(/\s+/)
  return [o, c] as const
}
const noteDelims = (v: VaultSummary | null) => {
  const [o = '%%', c = '%%'] = (v?.config.tags.note ?? '%% %%').split(/\s+/)
  return [o, c] as const
}

export function reproject(text: string, v: VaultSummary | null) {
  const [no, nc] = noteDelims(v)
  const [lo, lc] = linkDelims(v)
  const doc = parseFountain(text, no, nc)
  return { projection: project(doc, lo, lc), frontmatter: doc.frontmatter }
}

export const useStore = create<State & Actions>((set, get) => ({
  vault: null,
  files: [],
  path: null,
  text: '',
  diskHash: null,
  dirty: false,
  conflict: false,
  externalSeq: 0,
  projection: EMPTY,
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

  async openVault(pre?: VaultSummary) {
    const v = pre ?? (await window.api.vaultOpen())
    if (!v) return
    set({ vault: v, files: v.files, path: null, text: '', diskHash: null, dirty: false, proposal: null, projection: EMPTY })
    set({ keyStatus: await window.api.keysStatus(v.config.byok.provider) })
    void get().refreshGraph()
    const first = v.files.find((f) => f.kind === 'script')
    if (first) void get().openFile(first.path)
  },

  async refreshFiles() {
    if (get().vault) set({ files: await window.api.vaultList() })
  },

  async openFile(path) {
    if (get().dirty) await get().save()
    const { content, hash } = await window.api.fileRead(path)
    const { projection, frontmatter } = reproject(content, get().vault)
    set((s) => ({ path, text: content, diskHash: hash, dirty: false, conflict: false, proposal: null, projection, frontmatter, externalSeq: s.externalSeq + 1, versions: [] }))
    set({ versions: await window.api.versionList(path) })
  },

  setTextFromEditor(text) {
    const { projection, frontmatter } = reproject(text, get().vault)
    set({ text, dirty: true, projection, frontmatter, status: 'Sin guardar' })
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => void get().save(), 800)
  },

  setCursor(line, sel) {
    set({ cursorLine: line, selection: sel })
  },

  async save(force = false) {
    const { path, text, diskHash, dirty, conflict } = get()
    if (!path || !dirty || (conflict && !force)) return
    try {
      const { hash } = await window.api.fileWrite(path, text, force ? undefined : (diskHash ?? undefined), 'user')
      set({ diskHash: hash, dirty: false, conflict: false, status: 'Guardado' })
      set({ versions: await window.api.versionList(path) })
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

  async createFile(path, content) {
    await window.api.fileCreate(path, content)
    await get().refreshFiles()
    await get().openFile(path)
  },

  setScope(scope) {
    set({ scope })
  },

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
      set({ aiError: String(e).replace(/^Error: (Error invoking remote method '[^']+': )?(Error: )?/, '') })
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
    const { projection, frontmatter } = reproject(next, get().vault)
    set((s) => ({ text: next, projection, frontmatter, proposal: null, externalSeq: s.externalSeq + 1, dirty: true }))
    const { hash } = await window.api.fileWrite(path, next, diskHash ?? undefined, 'ai')
    set({ diskHash: hash, dirty: false, status: 'Propuesta aplicada y guardada', versions: await window.api.versionList(path) })
  },

  rejectProposal() {
    set({ proposal: null })
  },

  async restoreVersion(id) {
    const { path } = get()
    if (!path) return
    const content = await window.api.versionRead(path, id)
    const { projection, frontmatter } = reproject(content, get().vault)
    set((s) => ({ text: content, projection, frontmatter, externalSeq: s.externalSeq + 1, dirty: true }))
    await get().save(true)
  },

  async refreshGraph(build = false) {
    if (!get().vault) return
    set({ graph: build ? await window.api.graphBuild() : await window.api.graphStatus() })
  },

  async saveKey(key) {
    const v = get().vault
    if (!v || !key) return
    set({ keyStatus: await window.api.keysSet(v.config.byok.provider, key) })
  }
}))

window.addEventListener('vault.opened', (e) => void useStore.getState().openVault((e as CustomEvent<VaultSummary>).detail))

// Cambios externos (Obsidian u otro editor): recargar si no hay cambios locales; si los hay, marcar conflicto (I10).
window.api.onVaultChange((e) => {
  const s = useStore.getState()
  void s.refreshFiles()
  if (e.path !== s.path || e.hash === s.diskHash) return
  if (!s.dirty) void s.reloadFromDisk()
  else useStore.setState({ conflict: true, status: 'Conflicto: el archivo cambió en disco' })
})
