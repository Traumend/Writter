import { useStore } from './store'

// Export/import portable del proyecto: JSON versionado con rutas relativas y contenido íntegro de cada .md,
// más la configuración. Tolerante a campos desconocidos. Permite mover un vault entre máquinas sin nube.
export type Portable = { schemaVersion: 1; app: 'writter'; exportedAt: string; vault: string; config: unknown; files: { path: string; content: string }[] }

export async function exportProjectJson(): Promise<void> {
  const s = useStore.getState()
  if (!s.vault) return
  if (s.dirty) await s.save()
  const data: Portable = { schemaVersion: 1, app: 'writter', exportedAt: new Date().toISOString(), vault: s.vault.root.split(/[\\/]/).pop() ?? 'vault', config: s.vault.config, files: s.docs.map((d) => ({ path: d.path, content: d.content })) }
  const name = `${data.vault}-${new Date().toISOString().slice(0, 10)}.writter.json`
  await window.api.exportText(JSON.stringify(data, null, 1), name)
  useStore.setState({ status: 'Copia de seguridad exportada' })
}

// Importa en el vault abierto: crea los archivos que no existen y sobrescribe los existentes (con snapshot previo vía versionado).
export async function importProjectJson(): Promise<void> {
  const s = useStore.getState()
  if (!s.vault) return
  const raw = await window.api.pickText(['json'])
  if (!raw) return
  let data: Partial<Portable>
  try { data = JSON.parse(raw) as Partial<Portable> } catch { useStore.setState({ status: 'JSON inválido' }); return }
  if (data.app !== 'writter' || !Array.isArray(data.files)) { useStore.setState({ status: 'No es un proyecto Writter' }); return }
  if (!window.confirm(`${data.files.length} archivo(s) se escribirán en el vault actual (los existentes quedan versionados). ¿Continuar?`)) return
  let n = 0
  for (const f of data.files) {
    if (!f?.path || typeof f.content !== 'string' || f.path.includes('..')) continue
    if (s.files.some((x) => x.path === f.path)) await window.api.fileWrite(f.path, f.content, undefined, 'user')
    else await window.api.fileCreate(f.path, f.content)
    n++
  }
  await s.refreshFiles()
  await s.refreshDocs()
  useStore.setState({ status: `${n} archivo(s) importados` })
}
