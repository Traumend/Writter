import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { basename, extname, join, resolve } from 'node:path'
import { fdxToMd, fountainToMd } from '../core/convert'
import type { AdoptRole, AiRequest, Analysis, FileEntry, OpenResult, ProjectConfig, VaultChange, Version } from '../core/types/ipc'
import { aiText, analyze, runAi } from './ai'
import { getGraph, graphBuild, graphStatus, markStale } from './graph'
import { keyStatus, setKey } from './keys'
import * as V from './vault'

let win: BrowserWindow | null = null

const notify = (e: VaultChange) => {
  markStale()
  win?.webContents.send('vault.changed', e)
}

ipcMain.handle('vault.open', async (): Promise<OpenResult> => {
  const r = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
  const dir = r.filePaths[0]
  if (!dir) return null
  markStale()
  if (V.hasProject(dir)) return { kind: 'opened', summary: V.openVault(dir, notify) }
  const folders = V.scanFolder(dir)
  // Carpeta con contenido y sin proyecto -> proponer adopción; vacía -> crear layout por defecto directo.
  if (folders.length > 0) return { kind: 'adopt', root: dir, folders }
  return { kind: 'opened', summary: V.openVault(dir, notify) }
})
ipcMain.handle('vault.adopt', (_e, root: string, roles: Record<AdoptRole, string[]>) => {
  markStale()
  return V.adopt(root, roles, notify)
})
// Vinculador de carpetas: comprobar/crear/elegir subcarpetas sobre una raíz aún no abierta.
ipcMain.handle('folder.exists', (_e, root: string, rel: string) => V.folderExists(root, rel))
ipcMain.handle('folder.make', (_e, root: string, rel: string) => V.folderMake(root, rel))
ipcMain.handle('folder.pick', async (_e, root: string) => {
  const r = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'], defaultPath: root })
  return r.filePaths[0] ? V.relInside(root, r.filePaths[0]) : null
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
ipcMain.handle('export.bytes', async (_e, base64: string, suggested: string) => {
  const r = await dialog.showSaveDialog({ defaultPath: suggested })
  if (!r.filePath) return null
  writeFileSync(r.filePath, Buffer.from(base64, 'base64'))
  return r.filePath
})
ipcMain.handle('usage.get', () => V.usageStats())
ipcMain.handle('usage.reset', () => V.usageReset())
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
    backgroundColor: '#1a1c20',
    webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, nodeIntegration: false }
  })
  // Corrector ortográfico nativo (ES + EN) con menú contextual de sugerencias.
  try {
    win.webContents.session.setSpellCheckerLanguages(['es-ES', 'en-US'])
  } catch {
    /* algunos SO limitan idiomas; el corrector sigue con el default */
  }
  win.webContents.on('context-menu', (_e, params) => {
    if (!params.misspelledWord) return
    const menu = Menu.buildFromTemplate([
      ...params.dictionarySuggestions.map((s) => ({ label: s, click: () => win?.webContents.replaceMisspelling(s) })),
      ...(params.dictionarySuggestions.length ? [{ type: 'separator' as const }] : []),
      { label: 'Añadir al diccionario', click: () => win?.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord) }
    ])
    menu.popup()
  })
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) void win.loadURL(devUrl)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))
  // Ganchos de desarrollo: WRITTER_VAULT abre un vault al arrancar; WRITTER_EVAL ejecuta JS en el renderer; WRITTER_SHOT captura y sale.
  win.webContents.on('console-message', (_e, level, msg) => level >= 2 && console.log('[renderer]', msg))
  win.webContents.once('did-finish-load', () => {
    const v = process.env['WRITTER_VAULT']
    if (v) {
      // Igual que el diálogo: proyecto existente -> abrir; carpeta ajena con contenido -> proponer adopción.
      if (V.hasProject(v)) win?.webContents.send('vault.opened', V.openVault(v, notify))
      else {
        const folders = V.scanFolder(v)
        if (folders.length > 0) win?.webContents.send('vault.adopt', { kind: 'adopt', root: resolve(v), folders })
        else win?.webContents.send('vault.opened', V.openVault(v, notify))
      }
    }
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
