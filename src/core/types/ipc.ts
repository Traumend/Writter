// Contrato IPC (plan §3.2). Tipos compartidos main <-> renderer, sin dependencias de Node.
export type AdoptRole = 'script' | 'character' | 'location' | 'prop' | 'outline' | 'knowledge' | 'assets'

export type Provider = 'anthropic' | 'ollama' | 'openai' | 'openrouter' | 'gemini' | 'deepseek' | 'grok' | 'custom'

export type ProjectConfig = {
  format: { default: 'md' | 'fountain'; live_format: boolean }
  tags: { entity_link: string; note: string }
  graphify: { enabled: boolean; semantic_pass: 'off' | 'opt-in' | 'on'; backend: string }
  byok: { provider: Provider; model?: string; baseUrl?: string }
  prompts: { assistant: string; analysis: string }
  cover: { title: string; author: string; contact: string; draft: string; image: string }
  pdf: {
    paper: 'Letter' | 'A4'
    lineSpacing: number // 1.0 estándar
    watermark: string // vacío = sin marca de agua
    header: string // admite variables {title} {episode} {author} {date} {page} {pages}
    footer: string
  }
  roles: Record<AdoptRole, string[]> // carpetas por rol (adopción, Pieza 1); Writter lee desde aquí
  characterSliders: { id: string; label: string; lo: string; hi: string; color: string }[] // sliders personalizados del proyecto
}

export type FileKind = 'script' | 'character' | 'location' | 'prop' | 'outline' | 'knowledge' | 'other'
export type FileEntry = { path: string; kind: FileKind; name: string }
export type Doc = { path: string; content: string }

export type VaultSummary = { root: string; config: ProjectConfig; files: FileEntry[] }

// Asistente de adopción: una fila por carpeta con contenido, con rol propuesto editable.
export type FolderGuess = { path: string; role: AdoptRole | 'ignore'; mdCount: number; imageCount: number; hint: string }
export type AdoptionProposal = { kind: 'adopt'; root: string; folders: FolderGuess[] }
export type OpenResult = { kind: 'opened'; summary: VaultSummary } | AdoptionProposal | null

export type KeyStatus = { provider: string; present: boolean }

export type VaultChange = { path: string; hash: string | null } // null = borrado

export type Version = { id: string; ts: number; bytes: number; origin: 'user' | 'ai' | 'restore' | 'snapshot'; label?: string }

export type Scope = 'cursor' | 'node' | 'scene' | 'range' | 'outline' | 'full'

export type AiRequest = {
  path: string
  scope: Scope
  instruction: string
  from: number
  to: number
  target: string
  context: string
  docHash: string
  allowLocked: boolean
  locked: boolean
}

export type AiProposal = { replacement: string; rationale: string; tokensIn: number; tokensOut: number; model: string; docHash: string }
export type AiText = { text: string; tokensIn: number; tokensOut: number; model: string }

export type SceneAnalysis = { index: number; summary: string; emotion: string; intensity: number; tension: number; attention: number; commercial: number; notes: string[] }
export type Analysis = {
  id: string
  ts: number
  model: string
  structure: string
  plot: string
  theme: string
  tone: string
  notes: string[]
  writing: string[] // notas de escritura por escena ("Scene 6: …")
  format: string[] // notas de texto y formato
  scenes: SceneAnalysis[]
}

export type UsageStats = { calls: number; fails: number; tokensIn: number; tokensOut: number; byModel: { model: string; calls: number; tokensIn: number; tokensOut: number }[] }

export type GraphStatus = { available: boolean; reason?: string; nodes?: number; edges?: number; stale?: boolean }
export type GraphNode = { id: string; kind: FileKind | 'scene'; label: string }
export type GraphEdge = { source: string; target: string; kind: 'references' | 'appears' }
export type Graph = { nodes: GraphNode[]; edges: GraphEdge[] }

export type Api = {
  vaultOpen(): Promise<OpenResult>
  vaultOpenPath(dir: string): Promise<OpenResult>
  pickText(exts: string[]): Promise<string | null>
  vaultAdopt(root: string, roles: Record<AdoptRole, string[]>): Promise<VaultSummary>
  folderExists(root: string, rel: string): Promise<boolean>
  folderMake(root: string, rel: string): Promise<boolean>
  folderPick(root: string): Promise<string | null> // devuelve ruta relativa a root, o null
  vaultList(): Promise<FileEntry[]>
  vaultReadAll(): Promise<Doc[]>
  configWrite(config: ProjectConfig): Promise<ProjectConfig>
  fileRead(path: string): Promise<{ content: string; hash: string }>
  fileWrite(path: string, content: string, expectedHash?: string, origin?: Version['origin']): Promise<{ hash: string }>
  fileCreate(path: string, content: string): Promise<{ hash: string }>
  fileRename(oldPath: string, newPath: string): Promise<{ path: string }>
  fileDelete(path: string): Promise<{ path: string }>
  onVaultChange(cb: (e: VaultChange) => void): () => void
  keysSet(provider: string, key: string): Promise<KeyStatus>
  keysStatus(provider: string): Promise<KeyStatus>
  versionList(path: string): Promise<Version[]>
  versionRead(path: string, id: string): Promise<string>
  versionSnapshot(path: string, label: string): Promise<Version[]>
  aiRun(req: AiRequest): Promise<AiProposal>
  aiText(instruction: string, context: string): Promise<AiText>
  aiDevDoc(kind: string, text: string): Promise<AiText>
  aiDoctor(text: string, focus: string): Promise<AiText>
  aiAnalyze(path: string, text: string): Promise<Analysis>
  analysisList(path: string): Promise<{ id: string; ts: number }[]>
  analysisRead(path: string, id: string): Promise<Analysis>
  analysisSave(path: string, id: string, data: Analysis): Promise<void>
  graphStatus(): Promise<GraphStatus>
  graphBuild(): Promise<GraphStatus>
  graphGet(): Promise<Graph>
  assetPick(): Promise<string | null>
  assetRead(rel: string): Promise<string>
  exportPdf(html: string, suggestedName: string, opts: { paper: 'Letter' | 'A4'; headerTemplate?: string; footerTemplate?: string }): Promise<string | null>
  exportText(content: string, suggestedName: string): Promise<string | null>
  exportBytes(base64: string, suggestedName: string): Promise<string | null>
  importScript(): Promise<FileEntry | null>
  usageGet(): Promise<UsageStats>
  usageReset(): Promise<void>
}

export const DEFAULT_PROMPTS = {
  assistant: `Eres un asistente de escritura de guiones. Recibes un fragmento objetivo (landing point) y contexto.
Devuelve SOLO el texto que reemplaza al fragmento objetivo, en formato Fountain, sin explicaciones ni fences.
Si no hay que cambiar nada, devuelve el fragmento tal cual. Tras el texto, en una última línea separada, escribe "---RATIONALE---" seguido de una frase breve.`,
  analysis: `Eres un analista de guiones. Analiza el guión y responde ÚNICAMENTE con JSON válido con esta forma:
{"structure": string, "plot": string, "theme": string, "tone": string, "notes": string[],
 "writing": string[], "format": string[],
 "scenes": [{"index": number, "summary": string, "emotion": string, "intensity": 0-10, "tension": 0-10, "attention": 0-10, "commercial": 0-10, "notes": string[]}]}
"emotion" es una palabra (p. ej. Neutral, Diversión, Tensión, Miedo, Calma). "commercial" es el potencial comercial de la escena.
"writing" son notas de escritura por escena (formato "Scene N: …") y "format" notas de texto y formato. Incluye todas las escenas en orden, index desde 0.`
}

export const DEFAULT_CONFIG: ProjectConfig = {
  format: { default: 'md', live_format: true },
  tags: { entity_link: '[[ ]]', note: '%% %%' },
  graphify: { enabled: true, semantic_pass: 'opt-in', backend: 'ollama' },
  byok: { provider: 'anthropic' },
  prompts: DEFAULT_PROMPTS,
  cover: { title: '', author: '', contact: '', draft: '', image: '' },
  pdf: { paper: 'Letter', lineSpacing: 1, watermark: '', header: '', footer: '' },
  roles: {
    script: ['scripts'],
    character: ['entities/characters'],
    location: ['entities/locations'],
    prop: ['entities/props'],
    outline: ['outline'],
    knowledge: ['knowledge'],
    assets: ['assets']
  },
  characterSliders: []
}

export const KIND_DIR: Record<Exclude<FileKind, 'other'>, string> = {
  script: 'scripts',
  character: 'entities/characters',
  location: 'entities/locations',
  prop: 'entities/props',
  outline: 'outline',
  knowledge: 'knowledge'
}

// Carpeta primaria por rol para crear archivos nuevos, según el mapa configurado (fallback al default).
export function roleDir(config: ProjectConfig, kind: Exclude<FileKind, 'other'>): string {
  return config.roles[kind]?.[0] ?? KIND_DIR[kind]
}
