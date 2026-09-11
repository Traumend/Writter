import { diffLines } from 'diff'
import { useState } from 'react'
import { mdToFountain, mdToHtml } from '../core/convert'
import { estimateTokens } from '../core/safeguards'
import { KIND_DIR, type FileKind, type Scope } from '../core/types/ipc'
import { GraphView } from './GraphView'
import { useStore } from './store'

const KIND_LABEL: Record<FileKind, string> = { script: 'Guiones', character: 'Personajes', location: 'Locaciones', prop: 'Props', outline: 'Escaleta', knowledge: 'Conocimiento', other: 'Otros' }
const TEMPLATE: Record<Exclude<FileKind, 'other'>, (name: string) => string> = {
  script: (n) => `---\ntype: script\ntitle: "${n}"\nstatus: draft\nlocked: false\n---\n\nINT. LUGAR - DÍA\n\n`,
  character: (n) => `---\ntype: character\nname: "${n}"\nstatus: draft\nlocked: false\nrelationships: []\n---\n\n`,
  location: (n) => `---\ntype: location\nname: "${n}"\nlocked: false\n---\n\n`,
  prop: (n) => `---\ntype: prop\nname: "${n}"\ncategory: utileria\nlocked: false\n---\n\n`,
  outline: (n) => `---\ntype: outline\ntitle: "${n}"\nmethod: save-the-cat\n---\n\n# Acto 1\n\n`,
  knowledge: (n) => `---\ntype: knowledge\ntitle: "${n}"\n---\n\n`
}

function NewFile({ kind, onDone }: { kind: Exclude<FileKind, 'other'>; onDone: () => void }) {
  const [name, setName] = useState('')
  const createFile = useStore((s) => s.createFile)
  return (
    <input
      autoFocus
      placeholder={`Nombre · Enter`}
      value={name}
      onChange={(e) => setName(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onDone()
        if (e.key === 'Enter' && name.trim()) {
          void createFile(`${KIND_DIR[kind]}/${name.trim()}.md`, TEMPLATE[kind](name.trim())).then(onDone)
        }
      }}
    />
  )
}

export function LeftPanel() {
  const { vault, files, path, projection, cursorLine, openFile, createFile } = useStore()
  const [adding, setAdding] = useState<Exclude<FileKind, 'other'> | null>(null)
  if (!vault) return <p className="muted">Abre una carpeta como vault.</p>
  const scene = projection.scenes.find((s) => cursorLine >= s.startLine && cursorLine < s.endLine)
  const resolved = new Set(files.map((f) => f.name.toLowerCase()))
  const kinds = Object.keys(KIND_DIR) as Exclude<FileKind, 'other'>[]
  return (
    <>
      {projection.scenes.length > 0 && (
        <div className="block">
          <h2>Escenas · {projection.wordCount} palabras</h2>
          <ul>
            {projection.scenes.map((s) => (
              <li key={s.index} className={s === scene ? 'active' : ''} title={`${s.characters.join(', ')}`}>
                <span className="muted">{s.index + 1}.</span> {s.heading}
              </li>
            ))}
          </ul>
        </div>
      )}
      {scene && (
        <div className="block">
          <h2>En escena</h2>
          <ul>
            {scene.characters.map((c) => (
              <li key={c}>{c}</li>
            ))}
            {scene.links.map((l) => (
              <li key={l} className={resolved.has(l.toLowerCase()) ? '' : 'muted'}>
                [[{l}]]
                {!resolved.has(l.toLowerCase()) && (
                  <button className="mini" onClick={() => void createFile(`${KIND_DIR.character}/${l}.md`, TEMPLATE.character(l))}>
                    + ficha
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {kinds.map((k) => (
        <div className="block" key={k}>
          <h2>
            {KIND_LABEL[k]} <button className="mini" onClick={() => setAdding(k)}>+</button>
          </h2>
          {adding === k && <NewFile kind={k} onDone={() => setAdding(null)} />}
          <ul>
            {files.filter((f) => f.kind === k).map((f) => (
              <li key={f.path} className={f.path === path ? 'active' : ''} onClick={() => void openFile(f.path)}>
                {f.name}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  )
}

const SCOPES: [Scope, string][] = [['cursor', 'Cursor'], ['node', 'Nodo'], ['scene', 'Escena'], ['range', 'Rango'], ['outline', 'Escaleta'], ['full', 'Guión completo']]

export function ScopeBar() {
  const { scope, setScope, selection, text, cursorLine, projection } = useStore()
  const lines = text.split('\n')
  const scene = projection.scenes.find((s) => cursorLine >= s.startLine && cursorLine < s.endLine)
  const est =
    scope === 'range' && selection ? lines.slice(selection.from, selection.to).join('\n').length
    : scope === 'scene' && scene ? lines.slice(scene.startLine, scene.endLine).join('\n').length
    : scope === 'full' ? text.length : scope === 'outline' ? projection.scenes.length * 60 : 300
  return (
    <div className="scopebar">
      {SCOPES.map(([s, l]) => (
        <button key={s} className={s === scope ? 'on' : 'ghost'} disabled={s === 'range' && !selection} onClick={() => setScope(s)}>
          {l}
        </button>
      ))}
      <span className="grow" />
      <span className="muted">≈ {estimateTokens(' '.repeat(est))} tokens</span>
    </div>
  )
}

export function RightPanel() {
  const s = useStore()
  const [tab, setTab] = useState<'ai' | 'versions' | 'graph' | 'export'>('ai')
  const [instruction, setInstruction] = useState('')
  const [allowLocked, setAllowLocked] = useState(false)
  const [key, setKey] = useState('')
  const provider = s.vault?.config.byok.provider ?? 'anthropic'
  const locked = s.frontmatter['locked'] === true
  const name = s.path ? s.path.split('/').pop()!.replace(/\.md$/, '') : 'guion'

  return (
    <>
      <div className="tabs">
        {(['ai', 'versions', 'graph', 'export'] as const).map((t) => (
          <button key={t} className={tab === t ? 'on' : 'ghost'} onClick={() => setTab(t)}>
            {{ ai: 'Script Assistant', versions: 'Versiones', graph: 'Grafo', export: 'Exportar' }[t]}
          </button>
        ))}
      </div>

      {tab === 'ai' && (
        <>
          <div className="block">
            <h2>Clave BYOK · {provider}</h2>
            <p className="muted">{s.keyStatus?.present ? 'Guardada en el keychain del SO.' : provider === 'ollama' ? 'Ollama local, sin clave.' : 'Sin clave.'}</p>
            {provider !== 'ollama' && (
              <input type="password" placeholder="Pegar clave y Enter" value={key} disabled={!s.vault} onChange={(e) => setKey(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { void s.saveKey(key); setKey('') } }} />
            )}
          </div>
          <div className="block">
            <h2>Instrucción · scope: {SCOPES.find(([k]) => k === s.scope)?.[1]}</h2>
            <textarea rows={4} placeholder='Ej. "Haz el diálogo de Rick más evasivo sin revelar la clave"' value={instruction} onChange={(e) => setInstruction(e.target.value)} />
            {locked && (
              <label className="check">
                <input type="checkbox" checked={allowLocked} onChange={(e) => setAllowLocked(e.target.checked)} /> Autorizo editar este archivo <code>locked</code>
              </label>
            )}
            <button disabled={!s.path || s.aiBusy || !instruction.trim()} onClick={() => void s.runAi(instruction, allowLocked)}>
              {s.aiBusy ? 'Pensando…' : 'Proponer diff'}
            </button>
            {s.aiError && <p className="err">{s.aiError}</p>}
          </div>
          {s.proposal && (
            <div className="block">
              <h2>Propuesta · líneas {s.proposal.from + 1}-{s.proposal.to} · {s.proposal.tokensIn}→{s.proposal.tokensOut} tokens · {s.proposal.model}</h2>
              <pre className="diff">
                {diffLines(s.proposal.target + '\n', s.proposal.replacement + '\n').map((p, i) => (
                  <span key={i} className={p.added ? 'add' : p.removed ? 'del' : ''}>{p.value}</span>
                ))}
              </pre>
              {s.proposal.rationale && <p className="muted">{s.proposal.rationale}</p>}
              {s.proposal.docHash !== s.diskHash && <p className="err">Obsoleta: el documento cambió desde la petición.</p>}
              <div className="row">
                <button disabled={s.proposal.docHash !== s.diskHash} onClick={() => void s.acceptProposal()}>Aceptar</button>
                <button className="ghost" onClick={s.rejectProposal}>Rechazar</button>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'versions' && (
        <div className="block">
          <h2>Historial · {s.path ?? '—'}</h2>
          {s.versions.length === 0 && <p className="muted">Sin versiones aún. Cada guardado que cambia el archivo crea un punto restaurable.</p>}
          <ul>
            {s.versions.map((v) => (
              <li key={v.id} className="row">
                <span>{new Date(v.ts).toLocaleString()} · {v.origin} · {v.bytes} B</span>
                <span className="grow" />
                <button className="mini" onClick={() => void s.restoreVersion(v.id)}>Restaurar</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'graph' && (
        <div className="block">
          <h2>Índice · {s.graph ? `${s.graph.nodes} nodos · ${s.graph.edges} aristas` : 'off'}</h2>
          <p className="muted">{s.graph?.reason}</p>
          <button className="ghost" onClick={() => void s.refreshGraph(true)}>Reindexar</button>
          <GraphView />
        </div>
      )}

      {tab === 'export' && (
        <div className="block">
          <h2>Exportar {name}</h2>
          <div className="col">
            <button disabled={!s.path} onClick={() => void window.api.exportPdf(mdToHtml(s.text, name), `${name}.pdf`)}>PDF (formato industria)</button>
            <button disabled={!s.path} className="ghost" onClick={() => void window.api.exportText(mdToFountain(s.text), `${name}.fountain`)}>.fountain</button>
            <button className="ghost" onClick={() => void window.api.importScript().then((f) => f && s.refreshFiles().then(() => s.openFile(f.path)))}>Importar .fountain / .fdx</button>
          </div>
        </div>
      )}
    </>
  )
}
