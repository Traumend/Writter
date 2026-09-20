import { useMemo, useState } from 'react'
import { readFrontmatter } from '../../core/frontmatter'
import { cleanErr, useStore } from '../store'
import { BlurInput, EpisodeSelect } from '../ui'

// Documentos de desarrollo (Nivel 2): logline, sinopsis y treatment por IA, guardados como .md versionados.
const KINDS: [string, string][] = [['logline', 'Logline'], ['sinopsis', 'Sinopsis'], ['treatment', 'Treatment']]

function DocBlock({ kind, label, scriptName, scriptText }: { kind: string; label: string; scriptName: string; scriptText: string }) {
  const { files, docs, createFile, writeOther } = useStore()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const path = `knowledge/${scriptName} - ${label}.md`
  const doc = docs.find((d) => d.path === path)
  const body = doc ? readFrontmatter(doc.content).body.replace(/^\n+/, '') : ''
  const write = async (text: string) => {
    const content = `---\ntype: knowledge\ntitle: "${scriptName} - ${label}"\n---\n\n${text}\n`
    if (files.some((f) => f.path === path)) await writeOther(path, content)
    else await createFile(path, content, false)
  }
  const generate = async () => {
    setBusy(true)
    setErr('')
    try {
      await write((await window.api.aiDevDoc(kind, scriptText)).text.trim())
    } catch (e) {
      setErr(cleanErr(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="panelbox">
      <h2>{label} <button className="mini ghost" disabled={busy || !scriptText} onClick={() => void generate()}>{busy ? '…' : '✦ Generar con IA'}</button></h2>
      {err && <p className="err">{err}</p>}
      <div><BlurInput textarea rows={kind === 'treatment' ? 12 : kind === 'sinopsis' ? 6 : 3} value={body} placeholder={`${label} (se guarda en ${path})`} onCommit={(v) => void write(v)} /></div>
    </div>
  )
}

export function DevDocs() {
  const { files, docs } = useStore()
  const scripts = files.filter((f) => f.kind === 'script')
  const [ep, setEp] = useState<string | null>(scripts[0]?.path ?? null)
  const script = ep ?? scripts[0]?.path ?? null
  const scriptName = script ? script.split('/').pop()!.replace(/\.md$/, '') : ''
  const scriptText = useMemo(() => docs.find((d) => d.path === script)?.content ?? '', [docs, script])
  return (
    <main className="page scroll">
      <div className="toolbar">
        <EpisodeSelect value={script} onChange={setEp} />
        <span className="muted tiny">Loglines, sinopsis y treatment generados por IA, guardados en knowledge/ y versionados.</span>
      </div>
      {!script ? <p className="muted center">Crea o abre un guion.</p> : KINDS.map(([k, l]) => (
        <DocBlock key={k} kind={k} label={l} scriptName={scriptName} scriptText={scriptText} />
      ))}
    </main>
  )
}
