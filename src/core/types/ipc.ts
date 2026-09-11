// Contrato IPC (plan §3.2). Solo canales de M0; se extiende por hito.
export type ProjectConfig = {
  format: { default: 'md' | 'fountain'; live_format: boolean }
  tags: { entity_link: string; note: string }
  graphify: { enabled: boolean; semantic_pass: 'off' | 'opt-in' | 'on'; backend: string }
  byok: { provider: string }
}

export type VaultSummary = {
  root: string
  config: ProjectConfig
  scripts: string[] // rutas relativas de scripts/*.md
}

export type KeyStatus = { provider: string; present: boolean }

export type Api = {
  vaultOpen(): Promise<VaultSummary | null>
  fileRead(path: string): Promise<{ content: string; hash: string }>
  fileWrite(path: string, content: string): Promise<{ hash: string }>
  keysSet(provider: string, key: string): Promise<KeyStatus>
  keysStatus(provider: string): Promise<KeyStatus>
}

export const DEFAULT_CONFIG: ProjectConfig = {
  format: { default: 'md', live_format: true },
  tags: { entity_link: '[[ ]]', note: '%% %%' },
  graphify: { enabled: true, semantic_pass: 'opt-in', backend: 'ollama' },
  byok: { provider: 'anthropic' }
}
