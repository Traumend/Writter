import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { KeyStatus } from '../core/types/ipc'

// Claves BYOK (I3): cifradas con el keychain del SO, guardadas en userData, nunca en el vault ni en logs.
const file = () => join(app.getPath('userData'), 'keys.json')
const read = (): Record<string, string> => (existsSync(file()) ? JSON.parse(readFileSync(file(), 'utf8')) : {})

export function setKey(provider: string, key: string): KeyStatus {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('safeStorage no disponible en este SO')
  const keys = read()
  keys[provider] = safeStorage.encryptString(key).toString('base64')
  writeFileSync(file(), JSON.stringify(keys))
  return { provider, present: true }
}

export const keyStatus = (provider: string): KeyStatus => ({ provider, present: provider in read() })

// Solo para uso interno de main/ai.ts. Nunca cruza IPC.
export function getKey(provider: string): string | null {
  const enc = read()[provider]
  return enc ? safeStorage.decryptString(Buffer.from(enc, 'base64')) : null
}
