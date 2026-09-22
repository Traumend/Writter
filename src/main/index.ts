import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron'
import { buildMenu, type MenuSetup } from './menu'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, extname, join, resolve } from 'node:path'
import { fdxToMd, fountainToMd } from '../core/convert'
import type { AdoptRole, AiRequest, Analysis, FileEntry, OpenResult, ProjectConfig, VaultChange, Version } from '../core/types/ipc'
import { aiText, analyze, devDoc, doctorAi, runAi } from './ai'
import { getGraph, graphBuild, graphStatus, markStale } from './graph'
import { keyStatus, setKey } from './keys'
import * as V from './vault'

let win: BrowserWindow | null = null

// La ventana puede estar destruida cuando llega un evento del watcher o del menú: enviarle algo
// lanza "Object has been destroyed" como excepción no capturada del proceso principal.
const alive = () => !!win && !win.isDestroyed()
const send = (channel: string, payload?: unknown) => { if (alive()) win!.webContents.send(channel, payload) }

const notify = (e: VaultChange) => {
  markStale()
  send('vault.changed', e)
}

// Menú nativo: el renderer manda idioma, recientes y estado de los conmutadores; se reconstruye entero (barato).
ipcMain.on('menu.setup', (_e, setup: MenuSetup) => { if (alive()) buildMenu(win!, setup) })

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
// Abre un vault por ruta (Recientes) con la misma lógica que el diálogo.
ipcMain.handle('vault.openPath', (_e, dir: string): OpenResult => {
  if (!existsSync(dir)) return null
  markStale()
  if (V.hasProject(dir)) return { kind: 'opened', summary: V.openVault(dir, notify) }
  const folders = V.scanFolder(dir)
  if (folders.length > 0) return { kind: 'adopt', root: dir, folders }
  return { kind: 'opened', summary: V.openVault(dir, notify) }
})
// Elige y lee un archivo de texto (import JSON del proyecto).
ipcMain.handle('pick.text', async (_e, exts: string[]): Promise<string | null> => {
  const r = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: exts.join('/'), extensions: exts }] })
  const f = r.filePaths[0]
  return f ? readFileSync(f, 'utf8') : null
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
ipcMain.handle('ai.devdoc', (_e, kind: string, text: string) => devDoc(kind, text, V.readConfig()))
ipcMain.handle('ai.doctor', (_e, text: string, focus: string) => doctorAi(text, focus, V.readConfig()))
ipcMain.handle('file.rename', (_e, oldPath: string, newPath: string) => {
  const r = V.renameFile(oldPath, newPath)
  markStale()
  return r
})
ipcMain.handle('file.delete', (_e, rel: string) => {
  const r = V.deleteFile(rel)
  markStale()
  return r
})
ipcMain.handle('ai.analyze', async (_e, rel: string, text: string): Promise<Analysis> => {
  const a = await analyze(text, V.readConfig())
  const ts = Date.now()
  const id = V.saveAnalysis(rel, { ...a, ts })
  return { ...a, id, ts }
})
ipcMain.handle('analysis.list', (_e, rel: string) => V.listAnalyses(rel))
ipcMain.handle('analysis.read', (_e, rel: string, id: string) => ({ ...(V.readAnalysis(rel, id) as Omit<Analysis, 'id'>), id }))
ipcMain.handle('analysis.save', (_e, rel: string, id: string, data: Analysis) => V.overwriteAnalysis(rel, id, data))
ipcMain.handle('graph.status', () => graphStatus())
ipcMain.handle('graph.build', () => graphBuild())
ipcMain.handle('graph.get', () => getGraph())
ipcMain.handle('asset.pick', async () => {
  const r = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Imagen', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }] })
  return r.filePaths[0] ? V.importAsset(r.filePaths[0]) : null
})
ipcMain.handle('asset.read', (_e, rel: string) => V.readAsset(rel))

// Export PDF: ventana oculta + printToPDF nativo (sin dependencia externa).
ipcMain.handle('export.pdf', async (_e, html: string, suggested: string, opts: { paper: 'Letter' | 'A4'; headerTemplate?: string; footerTemplate?: string }) => {
  const r = await dialog.showSaveDialog({ defaultPath: suggested, filters: [{ name: 'PDF', extensions: ['pdf'] }] })
  if (!r.filePath) return null
  const w = new BrowserWindow({ show: false })
  await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  const hf = !!(opts.headerTemplate || opts.footerTemplate)
  const pdf = await w.webContents.printToPDF({
    pageSize: opts.paper,
    printBackground: true,
    displayHeaderFooter: hf,
    headerTemplate: opts.headerTemplate || '<span></span>',
    footerTemplate: opts.footerTemplate || '<span></span>',
    margins: hf ? { top: 0.7, bottom: 0.7, left: 1, right: 1 } : undefined
  })
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
  buildMenu(win, { lang: 'en', recents: [] })
  win.on('closed', () => { win = null; V.closeWatcher() })
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) void win.loadURL(devUrl)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))
  // Ganchos de desarrollo: WRITTER_VAULT abre un vault al arrancar; WRITTER_EVAL ejecuta JS en el renderer; WRITTER_SHOT captura y sale.
  win.webContents.on('console-message', (_e, level, msg) => level >= 2 && console.log('[renderer]', msg))
  win.webContents.once('did-finish-load', () => {
    const ws = /^(\d+)x(\d+)$/.exec(process.env['WRITTER_WIN'] ?? '') // tamaño de ventana para pruebas de anchura
    if (ws) win?.setSize(Number(ws[1]), Number(ws[2]))
    const v = process.env['WRITTER_VAULT']
    if (v) {
      // Igual que el diálogo: proyecto existente -> abrir; carpeta ajena con contenido -> proponer adopción.
      if (V.hasProject(v)) send('vault.opened', V.openVault(v, notify))
      else {
        const folders = V.scanFolder(v)
        if (folders.length > 0) send('vault.adopt', { kind: 'adopt', root: resolve(v), folders })
        else send('vault.opened', V.openVault(v, notify))
      }
    }
    const menuId = process.env['WRITTER_MENU'] // simula un clic del menú nativo (misma ruta que buildMenu)
    if (menuId) setTimeout(() => send('menu', menuId), 1500)
    const shot = process.env['WRITTER_SHOT']
    if (shot) {
      setTimeout(async () => {
        win?.show()
        win?.focus()
        const ev = process.env['WRITTER_EVAL']
        // El eval se repite mientras devuelva '__more__' (una captura por paso: shot.png, shot-1.png, …);
        // '__reload__' indica que va a recargar la página: esperar la nueva carga antes de capturar.
        for (let n = 0; ; n++) {
          const r: unknown = ev ? await win?.webContents.executeJavaScript(readFileSync(ev, 'utf8')) : undefined
          if (ev) console.log('[eval]', r)
          if (r === '__reload__') await new Promise((res) => win?.webContents.once('did-finish-load', () => setTimeout(res, 2500)))
          if (n === 0) console.log('[dom]', await win?.webContents.executeJavaScript('document.body.innerText'))
          const img = await win?.webContents.capturePage()
          if (img && !img.isEmpty()) writeFileSync(n ? shot.replace(/\.png$/i, `-${n}.png`) : shot, img.toPNG())
          else console.log('[shot] captura vacía')
          if (r !== '__more__') break
        }
        app.quit()
      }, 3500)
    }
  })
}

void app.whenReady().then(createWindow)
app.on('window-all-closed', () => { V.closeWatcher(); app.quit() })
