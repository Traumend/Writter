import { contextBridge, ipcRenderer } from 'electron'
import type { Api, VaultChange } from '../core/types/ipc'

// Superficie mínima: el renderer solo ve estas funciones, nunca fs/claves/red.
const api: Api = {
  vaultOpen: () => ipcRenderer.invoke('vault.open'),
  vaultList: () => ipcRenderer.invoke('vault.list'),
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
  aiRun: (req) => ipcRenderer.invoke('ai.run', req),
  graphStatus: () => ipcRenderer.invoke('graph.status'),
  graphBuild: () => ipcRenderer.invoke('graph.build'),
  graphGet: () => ipcRenderer.invoke('graph.get'),
  exportPdf: (html, name) => ipcRenderer.invoke('export.pdf', html, name),
  exportText: (content, name) => ipcRenderer.invoke('export.text', content, name),
  importScript: () => ipcRenderer.invoke('import.script')
}

contextBridge.exposeInMainWorld('api', api)
ipcRenderer.on('vault.opened', (_e, v) => window.dispatchEvent(new CustomEvent('vault.opened', { detail: v })))
