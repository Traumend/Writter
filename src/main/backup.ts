// Respaldos del proyecto (ScriptWriterX §51-53): una copia completa del vault en un ZIP, manual o
// periódica a una carpeta elegida, con rotación. Sin dependencias: ZIP "stored" propio.
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { zipStore } from '../core/docx'
import { zipEntries } from './swx'

export type BackupInfo = { file: string; bytes: number; files: number; ts: number }
export type RestoreSummary = { files: number; names: string[] }

const SKIP = new Set(['node_modules', '.git'])

function walk(dir: string, base: string, out: { name: string; data: Uint8Array }[]) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue
    const abs = join(dir, e.name)
    const rel = abs.slice(base.length + 1).split('\\').join('/')
    if (e.isDirectory()) walk(abs, base, out)
    else if (statSync(abs).size < 50 * 1024 * 1024) out.push({ name: rel, data: readFileSync(abs) })
  }
}

// Escribe el ZIP con todo el vault (incluye .narrative: versiones e historial).
export function createBackup(root: string, dest: string): BackupInfo {
  const files: { name: string; data: Uint8Array }[] = []
  walk(root, root, files)
  const zip = zipStore(files)
  mkdirSync(join(dest, '..'), { recursive: true })
  writeFileSync(dest, zip)
  return { file: dest, bytes: zip.length, files: files.length, ts: Date.now() }
}

export const backupName = (root: string) => `${basename(root)}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.zip`

// Rotación: deja solo las `keep` copias más recientes del mismo vault.
export function rotate(folder: string, prefix: string, keep: number): number {
  if (!existsSync(folder)) return 0
  const mine = readdirSync(folder)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.zip'))
    .map((f) => ({ f, ts: statSync(join(folder, f)).mtimeMs }))
    .sort((a, b) => b.ts - a.ts)
  let removed = 0
  for (const { f } of mine.slice(Math.max(1, keep))) {
    try { unlinkSync(join(folder, f)); removed++ } catch { /* archivo en uso: se borrará en la siguiente rotación */ }
  }
  return removed
}

// Lee un respaldo sin escribir nada: sirve para la previsualización antes de restaurar.
export function readBackup(file: string): RestoreSummary {
  const entries = zipEntries(readFileSync(file))
  return { files: entries.size, names: [...entries.keys()].slice(0, 20) }
}

// Restaura sobre el vault abierto. Nunca borra lo que no venga en el respaldo.
export function restoreBackup(root: string, file: string): RestoreSummary {
  const entries = zipEntries(readFileSync(file))
  const names: string[] = []
  for (const [name, data] of entries) {
    if (name.includes('..')) continue
    const abs = join(root, name)
    mkdirSync(join(abs, '..'), { recursive: true })
    writeFileSync(abs, data)
    names.push(name)
  }
  return { files: names.length, names: names.slice(0, 20) }
}

// Temporizador del respaldo automático: se rearma con cada cambio de ajustes.
let timer: ReturnType<typeof setInterval> | null = null
export function scheduleAuto(getState: () => { root: string | null; folder?: string; everyMinutes: number; keep: number }, onDone: (i: BackupInfo) => void): void {
  if (timer) clearInterval(timer)
  timer = null
  const { everyMinutes } = getState()
  if (!everyMinutes) return
  timer = setInterval(() => {
    const { root, folder, keep } = getState()
    if (!root || !folder || !existsSync(folder)) return
    try {
      const info = createBackup(root, join(folder, backupName(root)))
      rotate(folder, basename(root) + '-', keep)
      onDone(info)
    } catch { /* carpeta sin permiso o disco lleno: se reintenta en el siguiente ciclo */ }
  }, Math.max(5, everyMinutes) * 60_000)
}
