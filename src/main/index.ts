import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { fdxToMd, fountainToMd } from '../core/convert'
import type { AiRequest, FileEntry, VaultChange, VaultSummary, Version } from '../core/types/ipc'
import { runAi } from './ai'
import { getGraph, graphBuild, graphStatus, markStale } from './graph'
import { keyStatus, setKey } from './keys'
import { createFile, listFiles, listVersions, openVault, readConfig, readFile, readVersion, writeFile } from './vault'

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
  return openVault(dir, notify)
})
ipcMain.handle('vault.list', () => listFiles())
ipcMain.handle('file.read', (_e, rel: string) => readFile(rel))
ipcMain.handle('file.write', (_e, rel: string, content: string, expectedHash?: string, origin?: Version['origin']) => {
  const r = writeFile(rel, content, expectedHash, origin)
  markStale()
  return r
})
ipcMain.handle('file.create', (_e, rel: string, content: string) => {
  const r = createFile(rel, content)
  markStale()
  return r
})
ipcMain.handle('keys.set', (_e, provider: string, key: string) => setKey(provider, key))
ipcMain.handle('keys.status', (_e, provider: string) => keyStatus(provider))
ipcMain.handle('version.list', (_e, rel: string) => listVersions(rel))
ipcMain.handle('version.read', (_e, rel: string, id: string) => readVersion(rel, id))
ipcMain.handle('ai.run', (_e, req: AiRequest) => runAi(req, readConfig()))
ipcMain.handle('graph.status', () => graphStatus())
ipcMain.handle('graph.build', () => graphBuild())
ipcMain.handle('graph.get', () => getGraph())

// Export PDF: ventana oculta + printToPDF nativo (sin dependencia externa).
ipcMain.handle('export.pdf', async (_e, html: string, suggested: string) => {
  const r = await dialog.showSaveDialog({ defaultPath: suggested, filters: [{ name: 'PDF', extensions: ['pdf'] }] })
  if (!r.filePath) return null
  const w = new BrowserWindow({ show: false })
  await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  const pdf = await w.webContents.printToPDF({ pageSize: 'Letter', printBackground: false })
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
  createFile(rel, md)
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
  // Ganchos de desarrollo: WRITTER_VAULT abre un vault al arrancar; WRITTER_SHOT guarda una captura y sale.
  win.webContents.on('console-message', (_e, level, msg) => level >= 2 && console.log('[renderer]', msg))
  win.webContents.once('did-finish-load', () => {
    const v = process.env['WRITTER_VAULT']
    if (v) win?.webContents.send('vault.opened', openVault(v, notify))
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
