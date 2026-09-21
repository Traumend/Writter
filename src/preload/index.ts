import { contextBridge, ipcRenderer } from 'electron'
import type { Api, VaultChange } from '../core/types/ipc'

// Superficie mínima: el renderer solo ve estas funciones, nunca fs/claves/red.
const api: Api = {
  vaultOpen: () => ipcRenderer.invoke('vault.open'),
  vaultAdopt: (root, roles) => ipcRenderer.invoke('vault.adopt', root, roles),
  folderExists: (root, rel) => ipcRenderer.invoke('folder.exists', root, rel),
  folderMake: (root, rel) => ipcRenderer.invoke('folder.make', root, rel),
  folderPick: (root) => ipcRenderer.invoke('folder.pick', root),
  vaultList: () => ipcRenderer.invoke('vault.list'),
  vaultReadAll: () => ipcRenderer.invoke('vault.readAll'),
  configWrite: (c) => ipcRenderer.invoke('config.write', c),
  fileRead: (path) => ipcRenderer.invoke('file.read', path),
  fileWrite: (path, content, expectedHash, origin) => ipcRenderer.invoke('file.write', path, content, expectedHash, origin),
  fileCreate: (path, content) => ipcRenderer.invoke('file.create', path, content),
  fileRename: (oldPath, newPath) => ipcRenderer.invoke('file.rename', oldPath, newPath),
  fileDelete: (path) => ipcRenderer.invoke('file.delete', path),
  onVaultChange: (cb) => {
    const h = (_e: unknown, e: VaultChange) => cb(e)
    ipcRenderer.on('vault.changed', h)
    return () => ipcRenderer.off('vault.changed', h)
  },
  keysSet: (provider, key) => ipcRenderer.invoke('keys.set', provider, key),
  keysStatus: (provider) => ipcRenderer.invoke('keys.status', provider),
  versionList: (path) => ipcRenderer.invoke('version.list', path),
  versionRead: (path, id) => ipcRenderer.invoke('version.read', path, id),
  versionSnapshot: (path, label) => ipcRenderer.invoke('version.snapshot', path, label),
  aiRun: (req) => ipcRenderer.invoke('ai.run', req),
  aiText: (instruction, context) => ipcRenderer.invoke('ai.text', instruction, context),
  aiDevDoc: (kind, text) => ipcRenderer.invoke('ai.devdoc', kind, text),
  aiDoctor: (text, focus) => ipcRenderer.invoke('ai.doctor', text, focus),
  aiAnalyze: (path, text) => ipcRenderer.invoke('ai.analyze', path, text),
  analysisList: (path) => ipcRenderer.invoke('analysis.list', path),
  analysisRead: (path, id) => ipcRenderer.invoke('analysis.read', path, id),
  analysisSave: (path, id, data) => ipcRenderer.invoke('analysis.save', path, id, data),
  graphStatus: () => ipcRenderer.invoke('graph.status'),
  graphBuild: () => ipcRenderer.invoke('graph.build'),
  graphGet: () => ipcRenderer.invoke('graph.get'),
  assetPick: () => ipcRenderer.invoke('asset.pick'),
  assetRead: (rel) => ipcRenderer.invoke('asset.read', rel),
  exportPdf: (html, name, opts) => ipcRenderer.invoke('export.pdf', html, name, opts),
  exportText: (content, name) => ipcRenderer.invoke('export.text', content, name),
  exportBytes: (base64, name) => ipcRenderer.invoke('export.bytes', base64, name),
  importScript: () => ipcRenderer.invoke('import.script'),
  usageGet: () => ipcRenderer.invoke('usage.get'),
  usageReset: () => ipcRenderer.invoke('usage.reset')
}

contextBridge.exposeInMainWorld('api', api)
ipcRenderer.on('vault.opened', (_e, v) => window.dispatchEvent(new CustomEvent('vault.opened', { detail: v })))
ipcRenderer.on('vault.adopt', (_e, p) => window.dispatchEvent(new CustomEvent('vault.adopt', { detail: p })))
