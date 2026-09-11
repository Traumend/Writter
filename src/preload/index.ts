import { contextBridge, ipcRenderer } from 'electron'
import type { Api } from '../core/types/ipc'

// Superficie mínima: el renderer solo ve estas funciones, nunca fs/claves/red.
const api: Api = {
  vaultOpen: () => ipcRenderer.invoke('vault.open'),
  fileRead: (path) => ipcRenderer.invoke('file.read', path),
  fileWrite: (path, content) => ipcRenderer.invoke('file.write', path, content),
  keysSet: (provider, key) => ipcRenderer.invoke('keys.set', provider, key),
  keysStatus: (provider) => ipcRenderer.invoke('keys.status', provider)
}

contextBridge.exposeInMainWorld('api', api)
