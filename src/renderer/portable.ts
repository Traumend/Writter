import { readFrontmatter } from '../core/frontmatter'
import { readSceneMeta } from '../core/planning'
import { zipStore } from '../core/docx'
import { swxToVault, vaultToSwx, type ExportEntity, type ExportScript, type SwxFile } from '../core/swx'
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

// --- Interoperabilidad con ScriptWriterX -------------------------------------

const b64 = (bytes: Uint8Array) => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s) }

// Importa un proyecto .swx/.swxbackup: traduce el project.json a archivos del vault y los crea.
export async function importSwxProject(): Promise<void> {
  const s = useStore.getState()
  if (!s.vault) return
  const r = await window.api.importSwx()
  if (!r) return
  if ('error' in r) {
    useStore.setState({ status: r.error === 'encrypted' ? 'El archivo está cifrado: expórtalo sin contraseña desde ScriptWriterX' : 'No parece un proyecto de ScriptWriterX' })
    return
  }
  let file: SwxFile
  try { file = JSON.parse(r.json) as SwxFile } catch { useStore.setState({ status: 'JSON inválido' }); return }
  const roles = { script: s.roleDir('script'), character: s.roleDir('character'), location: s.roleDir('location'), prop: s.roleDir('prop'), knowledge: s.roleDir('knowledge'), outline: s.roleDir('outline') }
  const { files, report } = swxToVault(file, roles)
  if (!files.length) { useStore.setState({ status: 'El proyecto no traía escenas ni fichas' }); return }
  const existing = files.filter((f) => s.files.some((x) => x.path === f.path)).length
  const resumen = `${report.scripts} guion(es) · ${report.scenes} escenas · ${report.characters} personajes · ${report.locations} lugares · ${report.items} ítems · ${report.beats} beats · ${report.docs} documentos`
  const aviso = `${resumen}\n\n${files.length} archivo(s) se escribirán en el vault${existing ? ` (${existing} ya existen y quedarán versionados)` : ''}.${r.media ? `\n${r.media} archivo(s) de medios no se importan todavía.` : ''}\n\n¿Continuar?`
  if (!window.confirm(aviso)) return
  for (const f of files) {
    if (s.files.some((x) => x.path === f.path)) await window.api.fileWrite(f.path, f.content, undefined, 'user')
    else await window.api.fileCreate(f.path, f.content)
  }
  await s.refreshFiles()
  await s.refreshDocs()
  useStore.setState({ status: `ScriptWriterX importado: ${resumen}` })
}

// Exporta el vault como .swx (ZIP con project.json) para abrirlo en ScriptWriterX.
export async function exportSwxProject(): Promise<void> {
  const s = useStore.getState()
  if (!s.vault) return
  if (s.dirty) await s.save()
  const st = useStore.getState()
  if (!st.vault) return
  const scripts: ExportScript[] = st.files.filter((f) => f.kind === 'script').map((f) => {
    const doc = st.docs.find((d) => d.path === f.path)
    const fm = readFrontmatter(doc?.content ?? '').data
    const outline = st.docs.find((d) => d.path === `${st.roleDir('outline')}/${f.path.split('/').pop()!}`)
    return { name: f.name, content: doc?.content ?? '', season: String(fm['season'] ?? ''), episode: String(fm['episode'] ?? ''), sceneMeta: readSceneMeta(outline?.content) }
  })
  const entities: ExportEntity[] = st.files
    .filter((f) => f.kind === 'character' || f.kind === 'location' || f.kind === 'prop')
    .map((f) => ({ kind: f.kind as ExportEntity['kind'], name: f.name, content: st.docs.find((d) => d.path === f.path)?.content ?? '' }))
  const title = st.vault.config.cover.title || st.vault.root.split(/[\/]/).pop() || 'Proyecto'
  const json = vaultToSwx(title, st.vault.config.cover.author, scripts, entities)
  const zip = zipStore([{ name: 'project.json', data: new TextEncoder().encode(json) }])
  await window.api.exportBytes(b64(zip), `${title}.swx`)
  useStore.setState({ status: `Exportado a .swx: ${scripts.length} guion(es), ${entities.length} ficha(s)` })
}
