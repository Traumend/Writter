// Contrato IPC (plan §3.2). Tipos compartidos main <-> renderer, sin dependencias de Node.
export type ProjectConfig = {
  format: { default: 'md' | 'fountain'; live_format: boolean }
  tags: { entity_link: string; note: string }
  graphify: { enabled: boolean; semantic_pass: 'off' | 'opt-in' | 'on'; backend: string }
  byok: { provider: 'anthropic' | 'openai' | 'ollama'; model?: string }
}

export type FileKind = 'script' | 'character' | 'location' | 'prop' | 'outline' | 'knowledge' | 'other'
export type FileEntry = { path: string; kind: FileKind; name: string }

export type VaultSummary = { root: string; config: ProjectConfig; files: FileEntry[] }

export type KeyStatus = { provider: string; present: boolean }

export type VaultChange = { path: string; hash: string | null } // null = borrado

export type Version = { id: string; ts: number; bytes: number; origin: 'user' | 'ai' | 'restore' }

export type Scope = 'cursor' | 'node' | 'scene' | 'range' | 'outline' | 'full'

export type AiRequest = {
  path: string
  scope: Scope
  instruction: string
  // landing point: rango de líneas [from, to) sobre el que se ancla el diff
  from: number
  to: number
  target: string // texto actual del landing point
  context: string // contexto ya acotado por el renderer (texto local o resumen de grafo)
  docHash: string
  allowLocked: boolean // autorización explícita en la última instrucción (I4)
  locked: boolean // el archivo/región está locked
}

export type AiProposal = {
  replacement: string
  rationale: string
  tokensIn: number
  tokensOut: number
  model: string
  docHash: string
}

export type GraphStatus = { available: boolean; reason?: string; nodes?: number; edges?: number; stale?: boolean }

export type GraphNode = { id: string; kind: FileKind | 'scene'; label: string }
export type GraphEdge = { source: string; target: string; kind: 'references' | 'appears' }
export type Graph = { nodes: GraphNode[]; edges: GraphEdge[] }

export type Api = {
  vaultOpen(): Promise<VaultSummary | null>
  vaultList(): Promise<FileEntry[]>
  fileRead(path: string): Promise<{ content: string; hash: string }>
  // expectedHash: hash del último contenido conocido en disco; si difiere -> error 'conflict' (I10)
  fileWrite(path: string, content: string, expectedHash?: string, origin?: Version['origin']): Promise<{ hash: string }>
  fileCreate(path: string, content: string): Promise<{ hash: string }>
  onVaultChange(cb: (e: VaultChange) => void): () => void
  keysSet(provider: string, key: string): Promise<KeyStatus>
  keysStatus(provider: string): Promise<KeyStatus>
  versionList(path: string): Promise<Version[]>
  versionRead(path: string, id: string): Promise<string>
  aiRun(req: AiRequest): Promise<AiProposal>
  graphStatus(): Promise<GraphStatus>
  graphBuild(): Promise<GraphStatus>
  graphGet(): Promise<Graph>
  exportPdf(html: string, suggestedName: string): Promise<string | null>
  exportText(content: string, suggestedName: string): Promise<string | null>
  importScript(): Promise<FileEntry | null>
}

export const DEFAULT_CONFIG: ProjectConfig = {
  format: { default: 'md', live_format: true },
  tags: { entity_link: '[[ ]]', note: '%% %%' },
  graphify: { enabled: true, semantic_pass: 'opt-in', backend: 'ollama' },
  byok: { provider: 'anthropic' }
}

export const KIND_DIR: Record<Exclude<FileKind, 'other'>, string> = {
  script: 'scripts',
  character: 'entities/characters',
  location: 'entities/locations',
  prop: 'entities/props',
  outline: 'outline',
  knowledge: 'knowledge'
}
