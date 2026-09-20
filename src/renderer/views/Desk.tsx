import { diffLines } from 'diff'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { mdToFdx, mdToFountain, mdToHtml, mdToTxt, pdfVars } from '../../core/convert'
import { mdToDocx } from '../../core/docx'
import { readFrontmatter } from '../../core/frontmatter'
import { estimateTokens } from '../../core/safeguards'
import { type FileKind, type Scope } from '../../core/types/ipc'
import { Editor } from '../editor/Editor'
import { DEFAULT_SECTIONS, useStore } from '../store'
import { useAsset } from '../ui'

const KIND_LABEL: Record<FileKind, string> = { script: 'Episodios', character: 'Personajes', location: 'Locaciones', prop: 'Props', outline: 'Escaleta', knowledge: 'Conocimiento', other: 'Otros' }
export const TEMPLATE: Record<Exclude<FileKind, 'other'>, (name: string, extra?: Record<string, unknown>) => string> = {
  script: (n, x) => `---\ntype: script\ntitle: "${n}"\nseason: ${x?.['season'] ?? 1}\nepisode: ${x?.['episode'] ?? 1}\nstatus: draft\nlocked: false\n---\n\nINT. LUGAR - DÍA\n\n`,
  character: (n) => `---\ntype: character\nname: "${n}"\ngroup: none\naliases: []\nlocked: false\nrelationships: []\n---\n\n`,
  location: (n) => `---\ntype: location\nname: "${n}"\naliases: []\nlocked: false\n---\n\n`,
  prop: (n) => `---\ntype: prop\nname: "${n}"\ncategory: utileria\nlocked: false\n---\n\n`,
  outline: (n) => `---\ntype: outline\ntitle: "${n}"\nacts: []\nbeats: []\nnotes: []\n---\n\n`,
  knowledge: (n) => `---\ntype: knowledge\ntitle: "${n}"\n---\n\n`
}

function NewFile({ kind, onDone }: { kind: Exclude<FileKind, 'other'>; onDone: () => void }) {
  const [name, setName] = useState('')
  const [season, setSeason] = useState('1')
  const [episode, setEpisode] = useState('1')
  const createFile = useStore((s) => s.createFile)
  const roleDir = useStore((s) => s.roleDir)
  const go = () => {
    if (!name.trim()) return
    const n = name.trim()
    const file = kind === 'script' ? `S${season.padStart(2, '0')}E${episode.padStart(2, '0')} ${n}` : n
    void createFile(`${roleDir(kind)}/${file}.md`, TEMPLATE[kind](n, { season: Number(season), episode: Number(episode) })).then(onDone)
  }
  return (
    <div className="newfile">
      <input autoFocus placeholder="Nombre · Enter" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => (e.key === 'Enter' ? go() : e.key === 'Escape' && onDone())} />
      {kind === 'script' && (
        <div className="row">
          <input type="number" min={1} value={season} onChange={(e) => setSeason(e.target.value)} title="Temporada" />
          <input type="number" min={1} value={episode} onChange={(e) => setEpisode(e.target.value)} title="Episodio" />
        </div>
      )}
    </div>
  )
}

let dragId: string | null = null // sección en arrastre (reordenamiento nativo)

// Sección de biblioteca: cabecera arrastrable (reordenar) + plegable (colapsar). Estado en prefs.
function LibrarySection({ id, label, onAdd, children }: { id: string; label: string; onAdd: () => void; children: ReactNode }) {
  const { prefs, setPref } = useStore()
  const [over, setOver] = useState(false)
  const collapsed = prefs.collapsed.includes(id)
  const toggle = () => setPref('collapsed', collapsed ? prefs.collapsed.filter((x) => x !== id) : [...prefs.collapsed, id])
  const drop = () => {
    setOver(false)
    if (!dragId || dragId === id) return
    const order = orderedSections(prefs.sectionOrder)
    const next = order.filter((x) => x !== dragId)
    next.splice(next.indexOf(id), 0, dragId)
    setPref('sectionOrder', next)
    dragId = null
  }
  return (
    <div className={`block lib ${over ? 'dragover' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={drop}>
      <h2 draggable onDragStart={() => (dragId = id)} onDragEnd={() => (dragId = null)} title="Arrastra para reordenar · clic para plegar">
        <span className="drag" aria-hidden>⠿</span>
        <span className="grow link" onClick={toggle}>{collapsed ? '▸' : '▾'} {label}</span>
        <button className="mini" onClick={(e) => { e.stopPropagation(); onAdd() }}>+</button>
      </h2>
      {!collapsed && children}
    </div>
  )
}

// Orden de secciones saneado: válidas del pref + las que falten (prefs antiguas), sin duplicados.
function orderedSections(order: string[]): string[] {
  const valid = order.filter((x) => DEFAULT_SECTIONS.includes(x))
  return [...valid, ...DEFAULT_SECTIONS.filter((x) => !valid.includes(x))]
}

function LeftPanel() {
  const { vault, files, docs, path, projection, pagination, cursorLine, openFile, createFile, setCursor, moveScene, roleDir, prefs } = useStore()
  const [adding, setAdding] = useState<Exclude<FileKind, 'other'> | null>(null)
  const [q, setQ] = useState('')
  const [inContent, setInContent] = useState(false)
  const lines = useMemo(() => useStore.getState().text.split('\n'), [projection])
  if (!vault) return <p className="muted">Abre una carpeta como vault.</p>
  const scene = projection.scenes.find((s) => cursorLine >= s.startLine && cursorLine < s.endLine)
  const resolved = new Set(files.map((f) => f.name.toLowerCase()))
  const seasons = new Map<string, typeof files>()
  for (const f of files.filter((x) => x.kind === 'script')) {
    const d = docs.find((x) => x.path === f.path)
    const s = d ? String(readFrontmatter(d.content).data['season'] ?? '') : ''
    const key = s ? `Temporada ${s}` : 'Sin temporada'
    seasons.set(key, [...(seasons.get(key) ?? []), f])
  }
  const ql = q.toLowerCase()
  const scenes = projection.scenes.filter((s) => !ql || s.heading.toLowerCase().includes(ql) || (inContent && lines.slice(s.startLine, s.endLine).join('\n').toLowerCase().includes(ql)))

  // Cuerpo de cada sección de biblioteca por id.
  const body = (id: string) => {
    if (id === 'script') {
      return (
        <>
          {adding === 'script' && <NewFile kind="script" onDone={() => setAdding(null)} />}
          {[...seasons.entries()].sort().map(([season, list]) => (
            <div key={season}>
              <div className="muted tiny">{season}</div>
              <ul>{list.map((f) => <li key={f.path} className={f.path === path ? 'active' : ''} onClick={() => void openFile(f.path)}>{f.name}</li>)}</ul>
            </div>
          ))}
        </>
      )
    }
    const k = id as Exclude<FileKind, 'other'>
    return (
      <>
        {adding === k && <NewFile kind={k} onDone={() => setAdding(null)} />}
        <ul>{files.filter((f) => f.kind === k).map((f) => <li key={f.path} className={f.path === path ? 'active' : ''} onClick={() => void openFile(f.path)}>{f.name}</li>)}</ul>
      </>
    )
  }

  return (
    <>
      {/* Contextuales al documento abierto: fijas arriba. */}
      {path && projection.scenes.length > 0 && (
        <div className="block">
          <h2>Escenas · {projection.scenes.length}</h2>
          <input placeholder="Buscar escena…" value={q} onChange={(e) => setQ(e.target.value)} />
          <label className="check tiny"><input type="checkbox" checked={inContent} onChange={(e) => setInContent(e.target.checked)} /> también en contenido</label>
          <ul className="scenes">
            {scenes.map((s) => (
              <li key={s.index} className={s === scene ? 'active' : ''} onClick={() => setCursor(s.startLine, null)} title={`${s.wordCount} palabras · ≈${estimateTokens(lines.slice(s.startLine, s.endLine).join('\n'))} tokens · pág. ${pagination.lineToPage[s.startLine] ?? 1}\n${s.characters.join(', ')}`}>
                <span className="muted">{s.index + 1}.</span> <span className="grow ell">{s.heading}</span>
                <span className="mv" onClick={(e) => { e.stopPropagation(); moveScene(s.index, s.index - 1) }}>▲</span>
                <span className="mv" onClick={(e) => { e.stopPropagation(); moveScene(s.index, s.index + 1) }}>▼</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {scene && (
        <div className="block">
          <h2>En escena</h2>
          <ul>
            {scene.characters.map((c) => <li key={c}>{c}</li>)}
            {scene.links.map((l) => (
              <li key={l} className={resolved.has(l.toLowerCase()) ? '' : 'muted'}>
                [[{l}]]
                {!resolved.has(l.toLowerCase()) && <button className="mini" onClick={() => void createFile(`${roleDir('character')}/${l}.md`, TEMPLATE.character(l), false)}>+ ficha</button>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* Biblioteca: secciones reordenables y plegables (arrastra la cabecera). */}
      {orderedSections(prefs.sectionOrder).map((id) => (
        <LibrarySection key={id} id={id} label={KIND_LABEL[id as FileKind]} onAdd={() => setAdding(id as Exclude<FileKind, 'other'>)}>
          {body(id)}
        </LibrarySection>
      ))}
    </>
  )
}

// Uint8Array -> base64 por trozos (evita desbordar el stack con archivos grandes).
const toB64 = (u8: Uint8Array) => {
  let s = ''
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000))
  return btoa(s)
}

const SCOPES: [Scope, string][] = [['cursor', 'Cursor'], ['node', 'Nodo'], ['scene', 'Escena'], ['range', 'Rango'], ['outline', 'Escaleta'], ['full', 'Guión completo']]

function ScopeBar() {
  const { scope, setScope, selection, text, cursorLine, projection, showTags, toggleTags } = useStore()
  const lines = text.split('\n')
  const scene = projection.scenes.find((s) => cursorLine >= s.startLine && cursorLine < s.endLine)
  const est =
    scope === 'range' && selection ? lines.slice(selection.from, selection.to).join('\n').length
    : scope === 'scene' && scene ? lines.slice(scene.startLine, scene.endLine).join('\n').length
    : scope === 'full' ? text.length : scope === 'outline' ? projection.scenes.length * 60 : 300
  return (
    <div className="scopebar">
      {SCOPES.map(([s, l]) => (
        <button key={s} className={s === scope ? 'on' : 'ghost'} disabled={s === 'range' && !selection} onClick={() => setScope(s)}>{l}</button>
      ))}
      <span className="grow" />
      <button className={showTags ? 'on mini' : 'ghost mini'} onClick={toggleTags} title="Etiquetas de elemento">ABC</button>
      <span className="muted">≈ {Math.ceil(est / 4)} tokens</span>
    </div>
  )
}

function RightPanel() {
  const s = useStore()
  const [tab, setTab] = useState<'ai' | 'versions' | 'export'>('ai')
  const [instruction, setInstruction] = useState('')
  const [allowLocked, setAllowLocked] = useState(false)
  const [label, setLabel] = useState('')
  const [compare, setCompare] = useState<{ id: string; content: string } | null>(null)
  const cfg = s.vault?.config
  const coverImg = useAsset(cfg?.cover.image ?? '')
  const locked = s.frontmatter['locked'] === true
  const name = s.path ? s.path.split('/').pop()!.replace(/\.md$/, '') : 'guion'

  return (
    <>
      <div className="tabs">
        {(['ai', 'versions', 'export'] as const).map((t) => (
          <button key={t} className={tab === t ? 'on' : 'ghost'} onClick={() => setTab(t)}>{{ ai: 'Script Assistant', versions: 'Versiones', export: 'Exportar' }[t]}</button>
        ))}
      </div>

      {tab === 'ai' && (
        <>
          <div className="block">
            <h2>Instrucción · scope: {SCOPES.find(([k]) => k === s.scope)?.[1]}</h2>
            <textarea rows={4} placeholder='Ej. "Haz el diálogo de Rick más evasivo sin revelar la clave"' value={instruction} onChange={(e) => setInstruction(e.target.value)} />
            {locked && (
              <label className="check"><input type="checkbox" checked={allowLocked} onChange={(e) => setAllowLocked(e.target.checked)} /> Autorizo editar este archivo <code>locked</code></label>
            )}
            <button disabled={!s.path || s.aiBusy || !instruction.trim()} onClick={() => void s.runAi(instruction, allowLocked)}>{s.aiBusy ? 'Pensando…' : 'Proponer diff'}</button>
            {s.aiError && <p className="err">{s.aiError}</p>}
            {!s.keyStatus?.present && cfg?.byok.provider !== 'ollama' && <p className="muted tiny">Sin clave BYOK: configúrala en Ajustes.</p>}
          </div>
          {s.proposal && (
            <div className="block">
              <h2>Propuesta · líneas {s.proposal.from + 1}-{s.proposal.to} · {s.proposal.tokensIn}→{s.proposal.tokensOut} tokens · {s.proposal.model}</h2>
              <pre className="diff">
                {diffLines(s.proposal.target + '\n', s.proposal.replacement + '\n').map((p, i) => <span key={i} className={p.added ? 'add' : p.removed ? 'del' : ''}>{p.value}</span>)}
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
          <h2>Historial · {name}</h2>
          <div className="row">
            <input placeholder="Nombre del snapshot" value={label} onChange={(e) => setLabel(e.target.value)} />
            <button className="mini" disabled={!s.path || !label.trim()} onClick={() => { void s.snapshot(label.trim()); setLabel('') }}>Snapshot</button>
          </div>
          {s.versions.length === 0 && <p className="muted">Sin versiones aún. Cada guardado que cambia el archivo crea un punto restaurable.</p>}
          <ul>
            {s.versions.map((v) => (
              <li key={v.id} className="row">
                <span className="ell">{new Date(v.ts).toLocaleString()} · {v.label ?? v.origin} · {v.bytes} B</span>
                <span className="grow" />
                <button className="mini ghost" onClick={() => void window.api.versionRead(s.path!, v.id).then((content) => setCompare({ id: v.id, content }))}>Comparar</button>
                <button className="mini" onClick={() => void s.restoreVersion(v.id)}>Restaurar</button>
              </li>
            ))}
          </ul>
          {compare && (
            <>
              <h2>Versión → actual <button className="mini ghost" onClick={() => setCompare(null)}>cerrar</button></h2>
              <pre className="diff">
                {diffLines(compare.content, s.text).filter((p) => p.added || p.removed).map((p, i) => <span key={i} className={p.added ? 'add' : 'del'}>{p.value}</span>)}
              </pre>
            </>
          )}
        </div>
      )}

      {tab === 'export' && (
        <div className="block">
          <h2>Exportar {name}</h2>
          <div className="col">
            <button disabled={!s.path} onClick={() => {
              const vars = { title: cfg?.cover.title || name, episode: name, author: cfg?.cover.author }
              void window.api.exportPdf(
                mdToHtml(s.text, name, cfg ? { ...cfg.cover, imageDataUrl: coverImg } : undefined, cfg?.pdf),
                `${name}.pdf`,
                { paper: cfg?.pdf.paper ?? 'Letter', headerTemplate: pdfVars(cfg?.pdf.header ?? '', vars), footerTemplate: pdfVars(cfg?.pdf.footer ?? '', vars) }
              )
            }}>PDF (formato industria{cfg?.cover.title ? ' + portada' : ''})</button>
            <div className="row">
              <button disabled={!s.path} className="ghost" onClick={() => void window.api.exportBytes(toB64(mdToDocx(s.text)), `${name}.docx`)}>DOCX</button>
              <button disabled={!s.path} className="ghost" onClick={() => void window.api.exportText(mdToFdx(s.text), `${name}.fdx`)}>FDX</button>
              <button disabled={!s.path} className="ghost" onClick={() => void window.api.exportText(mdToFountain(s.text), `${name}.fountain`)}>Fountain</button>
              <button disabled={!s.path} className="ghost" onClick={() => void window.api.exportText(mdToTxt(s.text), `${name}.txt`)}>TXT</button>
            </div>
            <button className="ghost" onClick={() => void window.api.importScript().then((f) => f && s.refreshFiles().then(() => s.openFile(f.path)))}>Importar .fountain / .fdx</button>
          </div>
        </div>
      )}
    </>
  )
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

export function Desk() {
  const s = useStore()
  const { prefs, setPref } = s
  const mainRef = useRef<HTMLElement>(null)
  const cols = (l: number, r: number) => `${l}px 6px minmax(360px, 1fr) 6px ${r}px`
  useEffect(() => {
    if (mainRef.current) mainRef.current.style.gridTemplateColumns = cols(prefs.deskLeft, prefs.deskRight)
  }, [prefs.deskLeft, prefs.deskRight])

  // Divisor arrastrable: mueve el DOM en vivo, persiste al soltar (una escritura, sin re-render por frame).
  const resizer = (side: 'left' | 'right') => (e: React.PointerEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const l0 = prefs.deskLeft
    const r0 = prefs.deskRight
    let l = l0
    let r = r0
    const move = (ev: PointerEvent) => {
      if (side === 'left') l = clamp(l0 + (ev.clientX - startX), 200, 520)
      else r = clamp(r0 - (ev.clientX - startX), 240, 560)
      if (mainRef.current) mainRef.current.style.gridTemplateColumns = cols(l, r)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setPref('deskLeft', l)
      setPref('deskRight', r)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <main className="desk" ref={mainRef} style={{ gridTemplateColumns: cols(prefs.deskLeft, prefs.deskRight) }}>
      <aside><LeftPanel /></aside>
      <div className="resizer" onPointerDown={resizer('left')} title="Arrastra para redimensionar" />
      <section>
        {s.conflict && (
          <div className="banner">
            El archivo cambió en disco mientras lo editabas.
            <button className="mini" onClick={() => void s.reloadFromDisk()}>Recargar del disco</button>
            <button className="mini ghost" onClick={() => void s.save(true)}>Conservar lo mío</button>
          </div>
        )}
        {s.path ? (
          <>
            <ScopeBar />
            <Editor />
          </>
        ) : (
          <p className="muted center">Selecciona o crea un archivo. Ctrl+clic en un [[enlace]] abre la ficha.</p>
        )}
      </section>
      <div className="resizer" onPointerDown={resizer('right')} title="Arrastra para redimensionar" />
      <aside className="right"><RightPanel /></aside>
    </main>
  )
}
