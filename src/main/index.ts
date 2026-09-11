import { app, BrowserWindow, dialog, ipcMain, safeStorage } from 'electron'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parse, stringify } from 'yaml'
import { DEFAULT_CONFIG, type KeyStatus, type ProjectConfig, type VaultSummary } from '../core/types/ipc'
import { resolveInside } from '../core/vault/paths'

let vaultRoot: string | null = null

const sha = (s: string) => createHash('sha256').update(s).digest('hex')

function inVault(rel: string): string {
  if (!vaultRoot) throw new Error('Sin vault abierto')
  return resolveInside(vaultRoot, rel)
}

function openVault(root: string): VaultSummary {
  vaultRoot = resolve(root)
  for (const d of ['scripts', 'entities/characters', 'entities/locations', 'entities/props', 'outline', 'knowledge', 'assets', '.narrative/versions']) {
    mkdirSync(join(vaultRoot, d), { recursive: true })
  }
  const cfgPath = join(vaultRoot, '.narrative/project.yaml')
  if (!existsSync(cfgPath)) writeFileSync(cfgPath, stringify(DEFAULT_CONFIG))
  const config = { ...DEFAULT_CONFIG, ...(parse(readFileSync(cfgPath, 'utf8')) as Partial<ProjectConfig>) }
  const scripts = readdirSync(join(vaultRoot, 'scripts')).filter((f) => f.endsWith('.md')).map((f) => `scripts/${f}`)
  return { root: vaultRoot, config, scripts }
}

// Claves BYOK (I3): cifradas con el keychain del SO, guardadas en userData, nunca en el vault.
const keysFile = () => join(app.getPath('userData'), 'keys.json')
function readKeys(): Record<string, string> {
  return existsSync(keysFile()) ? JSON.parse(readFileSync(keysFile(), 'utf8')) : {}
}

ipcMain.handle('vault.open', async (): Promise<VaultSummary | null> => {
  const r = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
  const dir = r.filePaths[0]
  return dir ? openVault(dir) : null
})

ipcMain.handle('file.read', (_e, rel: string) => {
  const content = readFileSync(inVault(rel), 'utf8')
  return { content, hash: sha(content) }
})

ipcMain.handle('file.write', (_e, rel: string, content: string) => {
  writeFileSync(inVault(rel), content)
  return { hash: sha(content) }
})

ipcMain.handle('keys.set', (_e, provider: string, key: string): KeyStatus => {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('safeStorage no disponible en este SO')
  const keys = readKeys()
  keys[provider] = safeStorage.encryptString(key).toString('base64')
  writeFileSync(keysFile(), JSON.stringify(keys))
  return { provider, present: true }
})

ipcMain.handle('keys.status', (_e, provider: string): KeyStatus => ({ provider, present: provider in readKeys() }))

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#0f1115',
    webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, nodeIntegration: false }
  })
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) void win.loadURL(devUrl)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))
}

void app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
