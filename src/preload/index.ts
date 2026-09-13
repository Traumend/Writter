import { contextBridge, ipcRenderer } from 'electron'
import type { Api, VaultChange } from '../core/types/ipc'

// Superficie mínima: el renderer solo ve estas funciones, nunca fs/claves/red.
const api: Api = {
  vaultOpen: () => ipcRenderer.invoke('vault.open'),
  vaultAdopt: (root, roles) => ipcRenderer.invoke('vault.adopt', root, roles),
  vaultList: () => ipcRenderer.invoke('vault.list'),
  vaultReadAll: () => ipcRenderer.invoke('vault.readAll'),
  configWrite: (c) => ipcRenderer.invoke('config.write', c),
  fileRead: (path) => ipcRenderer.invoke('file.read', path),
  fileWrite: (path, content, expectedHash, origin) => ipcRenderer.invoke('file.write', path, content, expectedHash, origin),
  fileCreate: (path, content) => ipcRenderer.invoke('file.create', path, content),
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
  aiAnalyze: (path, text) => ipcRenderer.invoke('ai.analyze', path, text),
  analysisList: (path) => ipcRenderer.invoke('analysis.list', path),
  analysisRead: (path, id) => ipcRenderer.invoke('analysis.read', path, id),
  graphStatus: () => ipcRenderer.invoke('graph.status'),
  graphBuild: () => ipcRenderer.invoke('graph.build'),
  graphGet: () => ipcRenderer.invoke('graph.get'),
  assetPick: () => ipcRenderer.invoke('asset.pick'),
  assetRead: (rel) => ipcRenderer.invoke('asset.read', rel),
  exportPdf: (html, name, paper) => ipcRenderer.invoke('export.pdf', html, name, paper),
  exportText: (content, name) => ipcRenderer.invoke('export.text', content, name),
  importScript: () => ipcRenderer.invoke('import.script')
}

contextBridge.exposeInMainWorld('api', api)
ipcRenderer.on('vault.opened', (_e, v) => window.dispatchEvent(new CustomEvent('vault.opened', { detail: v })))
ipcRenderer.on('vault.adopt', (_e, p) => window.dispatchEvent(new CustomEvent('vault.adopt', { detail: p })))
