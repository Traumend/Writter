import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { fdxToMd, fountainToMd } from '../core/convert'
import type { AiRequest, Analysis, FileEntry, ProjectConfig, VaultChange, VaultSummary, Version } from '../core/types/ipc'
import { aiText, analyze, runAi } from './ai'
import { getGraph, graphBuild, graphStatus, markStale } from './graph'
import { keyStatus, setKey } from './keys'
import * as V from './vault'

let win: BrowserWindow | null = null

const notify = (e: VaultChange) => {
  markStale()
  win?.webContents.send('vault.changed', e)
}

ipcMain.handle('vault.open', async (): Promise<VaultSummary | null> => {
  const r = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
  const dir = r.filePaths[0]
  if (!dir) return null
  markStale()
  return V.openVault(dir, notify)
})
ipcMain.handle('vault.list', () => V.listFiles())
ipcMain.handle('vault.readAll', () => V.readAll())
ipcMain.handle('config.write', (_e, c: ProjectConfig) => V.writeConfig(c))
ipcMain.handle('file.read', (_e, rel: string) => V.readFile(rel))
ipcMain.handle('file.write', (_e, rel: string, content: string, expectedHash?: string, origin?: Version['origin']) => {
  const r = V.writeFile(rel, content, expectedHash, origin)
  markStale()
  return r
})
ipcMain.handle('file.create', (_e, rel: string, content: string) => {
  const r = V.createFile(rel, content)
  markStale()
  return r
})
ipcMain.handle('keys.set', (_e, provider: string, key: string) => setKey(provider, key))
ipcMain.handle('keys.status', (_e, provider: string) => keyStatus(provider))
ipcMain.handle('version.list', (_e, rel: string) => V.listVersions(rel))
ipcMain.handle('version.read', (_e, rel: string, id: string) => V.readVersion(rel, id))
ipcMain.handle('version.snapshot', (_e, rel: string, label: string) => V.snapshot(rel, label))
ipcMain.handle('ai.run', (_e, req: AiRequest) => runAi(req, V.readConfig()))
ipcMain.handle('ai.text', (_e, instruction: string, context: string) => aiText(instruction, context, V.readConfig()))
ipcMain.handle('ai.analyze', async (_e, rel: string, text: string): Promise<Analysis> => {
  const a = await analyze(text, V.readConfig())
  const ts = Date.now()
  const id = V.saveAnalysis(rel, { ...a, ts })
  return { ...a, id, ts }
})
ipcMain.handle('analysis.list', (_e, rel: string) => V.listAnalyses(rel))
ipcMain.handle('analysis.read', (_e, rel: string, id: string) => ({ ...(V.readAnalysis(rel, id) as Omit<Analysis, 'id'>), id }))
ipcMain.handle('graph.status', () => graphStatus())
ipcMain.handle('graph.build', () => graphBuild())
ipcMain.handle('graph.get', () => getGraph())
ipcMain.handle('asset.pick', async () => {
  const r = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Imagen', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }] })
  return r.filePaths[0] ? V.importAsset(r.filePaths[0]) : null
})
ipcMain.handle('asset.read', (_e, rel: string) => V.readAsset(rel))

// Export PDF: ventana oculta + printToPDF nativo (sin dependencia externa).
ipcMain.handle('export.pdf', async (_e, html: string, suggested: string, paper: 'Letter' | 'A4') => {
  const r = await dialog.showSaveDialog({ defaultPath: suggested, filters: [{ name: 'PDF', extensions: ['pdf'] }] })
  if (!r.filePath) return null
  const w = new BrowserWindow({ show: false })
  await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  const pdf = await w.webContents.printToPDF({ pageSize: paper, printBackground: true })
  w.destroy()
  writeFileSync(r.filePath, pdf)
  return r.filePath
})
ipcMain.handle('export.text', async (_e, content: string, suggested: string) => {
  const r = await dialog.showSaveDialog({ defaultPath: suggested })
  if (!r.filePath) return null
  writeFileSync(r.filePath, content)
  return r.filePath
})
ipcMain.handle('import.script', async (): Promise<FileEntry | null> => {
  const r = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Guión', extensions: ['fountain', 'fdx', 'txt'] }] })
  const src = r.filePaths[0]
  if (!src) return null
  const name = basename(src, extname(src))
  const raw = readFileSync(src, 'utf8')
  const md = extname(src).toLowerCase() === '.fdx' ? fdxToMd(raw, name) : fountainToMd(raw, name)
  const rel = `scripts/${name}.md`
  V.createFile(rel, md)
  markStale()
  return { path: rel, kind: 'script', name }
})

function createWindow() {
  win = new BrowserWindow({
    width: 1500,
    height: 950,
    backgroundColor: '#0f1115',
    webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, nodeIntegration: false }
  })
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) void win.loadURL(devUrl)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))
  // Ganchos de desarrollo: WRITTER_VAULT abre un vault al arrancar; WRITTER_EVAL ejecuta JS en el renderer; WRITTER_SHOT captura y sale.
  win.webContents.on('console-message', (_e, level, msg) => level >= 2 && console.log('[renderer]', msg))
  win.webContents.once('did-finish-load', () => {
    const v = process.env['WRITTER_VAULT']
    if (v) win?.webContents.send('vault.opened', V.openVault(v, notify))
    const shot = process.env['WRITTER_SHOT']
    if (shot) {
      setTimeout(async () => {
        win?.show()
        win?.focus()
        const ev = process.env['WRITTER_EVAL']
        if (ev) console.log('[eval]', await win?.webContents.executeJavaScript(readFileSync(ev, 'utf8')))
        console.log('[dom]', await win?.webContents.executeJavaScript('document.body.innerText'))
        const img = await win?.webContents.capturePage()
        if (img && !img.isEmpty()) writeFileSync(shot, img.toPNG())
        else console.log('[shot] captura vacía')
        app.quit()
      }, 3500)
    }
  })
}

void app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
