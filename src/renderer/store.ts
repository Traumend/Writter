import { create } from 'zustand'
import { readFrontmatter } from '../core/frontmatter'
import { paginate, type Pagination } from '../core/paginate'
import { parseFountain } from '../core/parser/fountain'
import { project, type Projection } from '../core/projection'
import { moveScene as moveSceneText } from '../core/scenes'
import { guessesToRoleMap } from '../core/adopt'
import { renameEntity } from '../core/rename'
import { writeFrontmatter } from '../core/frontmatter'
import { roleDir as roleDirOf } from '../core/types/ipc'
import { setLang, type Lang } from './i18n'
import type { AdoptionProposal, AdoptRole, AiProposal, Doc, FileEntry, FileKind, GraphStatus, KeyStatus, ProjectConfig, Scope, VaultSummary, Version } from '../core/types/ipc'

// Vinculador de carpetas: raíz del Vault + una carpeta por rol (role-first, editable).
export type Linker = { root: string; roles: Record<AdoptRole, string> }
const ADOPT_ROLES: AdoptRole[] = ['script', 'character', 'location', 'prop', 'outline', 'knowledge', 'assets']

export type Proposal = AiProposal & { from: number; to: number; target: string }
export type Tab = 'desk' | 'breakdown' | 'dev' | 'production' | 'settings'

// Preferencias de interfaz (solo renderer, localStorage): no son datos del proyecto.
export type AccentName = 'naranja' | 'ambar' | 'azul' | 'verde' | 'rosa'
export type Scale = 'compact' | 'normal' | 'large'
export const DEFAULT_SECTIONS = ['script', 'character', 'location', 'prop', 'outline', 'knowledge']
// deskLeft/deskRight: ancho de los paneles laterales del Escritorio (arrastrables).
// sectionOrder/collapsed: orden y plegado de las secciones de biblioteca (arrastrables).
export type Prefs = { accent: AccentName; scale: Scale; deskLeft: number; deskRight: number; sectionOrder: string[]; collapsed: string[]; tabs: string[]; focus: boolean; page: boolean; lang: Lang }
export const ALL_TABS = ['desk', 'breakdown', 'dev', 'production', 'settings']
export const ACCENTS: Record<AccentName, [string, string, string]> = {
  naranja: ['#ff5a1f', '#e64d13', '#1a1000'],
  ambar: ['#f5a623', '#e0930f', '#1a1200'],
  azul: ['#4f8cff', '#3f79e6', '#08122a'],
  verde: ['#2fc784', '#28ad72', '#04140d'],
  rosa: ['#ff5a8a', '#e64878', '#1a0410']
}
const SCALE_PX: Record<Scale, string> = { compact: '12.5px', normal: '13.5px', large: '15px' }
const DEFAULT_PREFS: Prefs = { accent: 'naranja', scale: 'normal', deskLeft: 268, deskRight: 350, sectionOrder: DEFAULT_SECTIONS, collapsed: [], tabs: ALL_TABS, focus: false, page: false, lang: 'en' }
export const DEFAULT_LAYOUT = { deskLeft: 268, deskRight: 350, sectionOrder: DEFAULT_SECTIONS, collapsed: [] as string[] }

function loadPrefs(): Prefs {
  try {
    return { ...DEFAULT_PREFS, ...(JSON.parse(localStorage.getItem('writter.prefs') || '{}') as Partial<Prefs>) }
  } catch {
    return DEFAULT_PREFS
  }
}

export function applyPrefs(p: Prefs) {
  const [a, ap, on] = ACCENTS[p.accent]
  const r = document.documentElement.style
  r.setProperty('--accent', a)
  r.setProperty('--accent-press', ap)
  r.setProperty('--on-accent', on)
  r.setProperty('font-size', SCALE_PX[p.scale])
  setLang(p.lang)
  document.documentElement.lang = p.lang
}
export type DevTab = 'characters' | 'beats' | 'map' | 'analysis' | 'docs'

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
  sceneTrash: { heading: string; content: string }[] // papelera de escenas en sesión (recuperación permanente vía Versiones)
  linker: Linker | null
  prefs: Prefs
  prefsOpen: boolean
  searchOpen: boolean
  rename: { path: string; name: string; terms: string[] } | null
}

type Actions = {
  setTab(t: Tab): void
  setDevTab(t: DevTab): void
  openVault(): Promise<void>
  applySummary(v: VaultSummary): Promise<void>
  openLinker(): void
  repickRoot(): Promise<void>
  linkVault(roles: Record<AdoptRole, string>): Promise<void>
  cancelLink(): void
  roleDir(kind: Exclude<FileKind, 'other'>): string
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
  deleteEntity(path: string): Promise<void>
  setScope(s: Scope): void
  runAi(instruction: string, allowLocked: boolean): Promise<void>
  acceptProposal(): Promise<void>
  rejectProposal(): void
  restoreVersion(id: string): Promise<void>
  snapshot(label: string): Promise<void>
  moveScene(from: number, to: number): void
  addGroup(name: string): void
  deleteScenes(indexes: number[]): void
  restoreScene(i: number): void
  refreshGraph(build?: boolean): Promise<void>
  saveKey(key: string): Promise<void>
  saveConfig(c: ProjectConfig): Promise<void>
  toggleTags(): void
  setPref<K extends keyof Prefs>(k: K, v: Prefs[K]): void
  setLanguage(l: Lang): void
  resetLayout(): void
  openPrefs(): void
  closePrefs(): void
  openSearch(): void
  closeSearch(): void
  openRename(path: string, name: string, terms: string[]): void
  closeRename(): void
  applyRename(to: string): Promise<void>
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
  sceneTrash: [],
  linker: null,
  prefs: loadPrefs(),
  prefsOpen: false,
  searchOpen: false,
  rename: null,

  openRename: (path, name, terms) => set({ rename: { path, name, terms } }),
  closeRename: () => set({ rename: null }),
  async applyRename(to) {
    const r = get().rename
    if (!r || !to.trim() || to === r.name) return set({ rename: null })
    const results = renameEntity(get().docs, r.terms, to)
    // Escribe todos los archivos cambiados salvo la propia ficha (se renombra aparte).
    for (const res of results) if (res.path !== r.path) await window.api.fileWrite(res.path, res.content, undefined, 'user')
    // Ficha: actualiza su contenido (nombre en frontmatter) y renombra el archivo.
    const fichaContent = results.find((x) => x.path === r.path)?.content ?? get().docs.find((d) => d.path === r.path)?.content ?? ''
    await window.api.fileWrite(r.path, writeFrontmatter(fichaContent, { name: to }), undefined, 'user')
    const dir = r.path.slice(0, r.path.lastIndexOf('/') + 1)
    const newPath = `${dir}${to}.md`
    if (newPath !== r.path) {
      try {
        await window.api.fileRename(r.path, newPath)
      } catch {
        /* si ya existe un archivo con ese nombre, deja la ficha con el nombre nuevo pero sin renombrar */
      }
    }
    set({ rename: null, status: `Renombrado a "${to}"` })
    await get().refreshFiles()
    await get().refreshDocs()
    if (get().path === r.path) await get().openFile(newPath)
  },

  setPref(k, v) {
    const prefs = { ...get().prefs, [k]: v }
    localStorage.setItem('writter.prefs', JSON.stringify(prefs))
    applyPrefs(prefs)
    set({ prefs })
  },
  // Cambia el idioma y recarga para re-renderizar toda la interfaz en el nuevo idioma.
  setLanguage(l) {
    const prefs = { ...get().prefs, lang: l }
    localStorage.setItem('writter.prefs', JSON.stringify(prefs))
    location.reload()
  },
  resetLayout() {
    const prefs = { ...get().prefs, ...DEFAULT_LAYOUT }
    localStorage.setItem('writter.prefs', JSON.stringify(prefs))
    set({ prefs })
  },
  openPrefs: () => set({ prefsOpen: true }),
  closePrefs: () => set({ prefsOpen: false }),
  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),

  setTab: (tab) => set({ tab }),
  setDevTab: (devTab) => set({ devTab }),

  async openVault() {
    const r = await window.api.vaultOpen()
    if (!r) return
    if (r.kind === 'adopt') set({ linker: { root: r.root, roles: guessesToRoleMap(r.folders) } }) // carpeta ajena -> vinculador
    else await get().applySummary(r.summary)
  },

  // Vincular carpetas del vault ya abierto (remapear): prellena desde su config.
  openLinker() {
    const v = get().vault
    if (!v) return
    const roles = {} as Record<AdoptRole, string>
    for (const k of ADOPT_ROLES) roles[k] = v.config.roles[k]?.[0] ?? k
    set({ linker: { root: v.root, roles } })
  },

  async repickRoot() {
    const r = await window.api.vaultOpen()
    if (!r) return
    if (r.kind === 'adopt') set({ linker: { root: r.root, roles: guessesToRoleMap(r.folders) } })
    else {
      set({ linker: null })
      await get().applySummary(r.summary)
    }
  },

  async linkVault(roles) {
    const l = get().linker
    if (!l) return
    const arr = {} as Record<AdoptRole, string[]>
    for (const k of ADOPT_ROLES) arr[k] = [roles[k] || k]
    set({ linker: null })
    await get().applySummary(await window.api.vaultAdopt(l.root, arr))
  },

  cancelLink: () => set({ linker: null }),

  roleDir: (kind) => {
    const v = get().vault
    return v ? roleDirOf(v.config, kind) : kind
  },

  async applySummary(v) {
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

  // Borra una ficha (.md). Recuperable desde el historial de versiones. Cierra el editor si estaba abierta.
  async deleteEntity(path) {
    await window.api.fileDelete(path)
    if (get().path === path) set({ path: null, text: '', diskHash: null, dirty: false, projection: EMPTY, pagination: NOPAG })
    await get().refreshFiles()
    await get().refreshDocs()
  },

  async refreshDocs() {
    if (get().vault) set({ docs: await window.api.vaultReadAll() })
  },

  async openFile(path, gotoLine) {
    if (get().dirty) await get().save()
    const { content, hash } = await window.api.fileRead(path)
    const r = reproject(content, get().vault)
    set((s) => ({ path, text: content, diskHash: hash, dirty: false, conflict: false, proposal: null, ...r, externalSeq: s.externalSeq + 1, versions: [], sceneTrash: [], cursorLine: gotoLine ?? 0 }))
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

  // Inserta una sección Fountain (`# name`) antes de la escena bajo el cursor -> nuevo grupo (nativo del .md).
  addGroup(name) {
    const s = get()
    const label = name.trim()
    if (!label) return
    const scene = s.projection.scenes.find((sc) => s.cursorLine >= sc.startLine && s.cursorLine < sc.endLine) ?? s.projection.scenes[0]
    const lines = s.text.split('\n')
    const at = scene ? scene.startLine : lines.length
    lines.splice(at, 0, `# ${label}`, '')
    get().setTextExternal(lines.join('\n'))
  },

  // Borra escenas (por índice) del texto y las guarda en la papelera de sesión. Recuperación permanente vía Versiones.
  // ponytail: papelera en memoria (se pierde al recargar); el disco ya es recuperable con el historial de versiones.
  deleteScenes(indexes) {
    const s = get()
    const lines = s.text.split('\n')
    const picked = s.projection.scenes.filter((sc) => indexes.includes(sc.index)).sort((a, b) => b.startLine - a.startLine)
    if (!picked.length) return
    const trash = picked.map((sc) => ({ heading: sc.heading, content: lines.slice(sc.startLine, sc.endLine).join('\n').replace(/\n+$/, '') }))
    for (const sc of picked) lines.splice(sc.startLine, sc.endLine - sc.startLine)
    set((st) => ({ sceneTrash: [...trash.reverse(), ...st.sceneTrash] }))
    get().setTextExternal(lines.join('\n'))
  },

  // Reinserta una escena de la papelera al final del documento.
  restoreScene(i) {
    const s = get()
    const item = s.sceneTrash[i]
    if (!item) return
    const next = s.text.replace(/\n+$/, '') + '\n\n' + item.content + '\n'
    set((st) => ({ sceneTrash: st.sceneTrash.filter((_, j) => j !== i) }))
    get().setTextExternal(next)
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

applyPrefs(useStore.getState().prefs) // aplica acento y tamaño al cargar

window.addEventListener('vault.opened', (e) => void useStore.getState().applySummary((e as CustomEvent<VaultSummary>).detail))
window.addEventListener('vault.adopt', (e) => {
  const p = (e as CustomEvent<AdoptionProposal>).detail
  useStore.setState({ linker: { root: p.root, roles: guessesToRoleMap(p.folders) } })
})

// Cambios externos (Obsidian u otro editor): recargar si no hay cambios locales; si los hay, marcar conflicto (I10).
window.api.onVaultChange((e) => {
  const s = useStore.getState()
  void s.refreshFiles()
  void s.refreshDocs()
  if (e.path !== s.path || e.hash === s.diskHash) return
  if (!s.dirty) void s.reloadFromDisk()
  else useStore.setState({ conflict: true, status: 'Conflicto: el archivo cambió en disco' })
})
