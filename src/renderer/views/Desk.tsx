import { diffLines } from 'diff'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { mdToFdx, mdToFountain, mdToHtml, mdToTxt, pdfVars } from '../../core/convert'
import { mdToDocx } from '../../core/docx'
import { readFrontmatter } from '../../core/frontmatter'
import { estimateTokens } from '../../core/safeguards'
import { type FileKind, type Scope } from '../../core/types/ipc'
import { Editor } from '../editor/Editor'
import { t } from '../i18n'
import { DEFAULT_SECTIONS, useStore } from '../store'
import { Icon, useAsset } from '../ui'

const KIND_LABEL: Record<FileKind, string> = { script: 'Episodios', character: 'Personajes', location: 'Locaciones', prop: 'Props', outline: 'Escaleta', knowledge: 'Conocimiento', other: 'Otros' }
export const TEMPLATE: Record<Exclude<FileKind, 'other'>, (name: string, extra?: Record<string, unknown>) => string> = {
  script: (n, x) => `---\ntype: script\ntitle: "${n}"\nseason: ${x?.['season'] ?? 1}\nepisode: ${x?.['episode'] ?? 1}\nstatus: draft\nlocked: false\n---\n\nINT. LUGAR - DÍA\n\n`,
  character: (n) => `---\ntype: character\nname: "${n}"\ngroup: none\naliases: []\nlocked: false\nrelationships: []\n---\n\n`,
  location: (n) => `---\ntype: location\nname: "${n}"\naliases: []\nlocked: false\n---\n\n`,
  prop: (n) => `---\ntype: prop\nname: "${n}"\ncategory: utileria\nlocked: false\n---\n\n`,
  outline: (n) => `---\ntype: outline\ntitle: "${n}"\nacts: []\nbeats: []\nnotes: []\n---\n\n`,
  knowledge: (n) => `---\ntype: knowledge\ntitle: "${n}"\n---\n\n`
}

// Sin guiones no hay nada que mostrar: se puede crear un episodio aquí mismo o vincular la carpeta donde ya vive la historia.
export function NoScripts() {
  const openLinker = useStore((s) => s.openLinker)
  const [creating, setCreating] = useState(false)
  return (
    <div className="empty">
      <p className="muted">{t('No hay guiones en el vault. Crea un episodio nuevo o vincula la carpeta donde ya vive tu historia (capítulos o episodios).')}</p>
      <div className="row">
        <button onClick={() => setCreating(true)}><Icon name="plus" size={12} />{t('Nuevo episodio')}</button>
        <button className="ghost" onClick={openLinker}>{t('Vincular carpetas…')}</button>
      </div>
      {creating && <NewFile kind="script" onDone={() => setCreating(false)} />}
    </div>
  )
}

export function NewFile({ kind, onDone }: { kind: Exclude<FileKind, 'other'>; onDone: (created?: boolean) => void }) {
  const [name, setName] = useState('')
  const [season, setSeason] = useState('1')
  const [episode, setEpisode] = useState('1')
  const createFile = useStore((s) => s.createFile)
  const roleDir = useStore((s) => s.roleDir)
  const go = () => {
    if (!name.trim()) return
    const n = name.trim()
    const file = kind === 'script' ? `S${season.padStart(2, '0')}E${episode.padStart(2, '0')} ${n}` : n
    void createFile(`${roleDir(kind)}/${file}.md`, TEMPLATE[kind](n, { season: Number(season), episode: Number(episode) })).then(() => onDone(true))
  }
  return (
    <div className="newfile">
      <input autoFocus placeholder={t('Nombre · Enter')} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => (e.key === 'Enter' ? go() : e.key === 'Escape' && onDone())} />
      {kind === 'script' && (
        <div className="row">
          <input type="number" min={1} value={season} onChange={(e) => setSeason(e.target.value)} title={t('Temporada')} />
          <input type="number" min={1} value={episode} onChange={(e) => setEpisode(e.target.value)} title={t('Episodio')} />
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
      <h2 draggable onDragStart={() => (dragId = id)} onDragEnd={() => (dragId = null)} title={t('Arrastra para reordenar · clic para plegar')}>
        <span className="drag" aria-hidden>⠿</span>
        <span className="grow link" onClick={toggle}>{collapsed ? '▸' : '▾'} {label}</span>
        <button className="mini" title={t('Nuevo…')} onClick={(e) => { e.stopPropagation(); onAdd() }}><Icon name="plus" size={12} /></button>
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
  const { vault, files, docs, path, projection, pagination, cursorLine, openFile, createFile, setCursor, moveScene, roleDir, prefs, addGroup, deleteScenes, restoreScene, sceneTrash } = useStore()
  const [adding, setAdding] = useState<Exclude<FileKind, 'other'> | null>(null)
  const [q, setQ] = useState('')
  const [inContent, setInContent] = useState(false)
  const [groupFilter, setGroupFilter] = useState('')
  const [multi, setMulti] = useState(false)
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [newGroup, setNewGroup] = useState<string | null>(null)
  const [showTrash, setShowTrash] = useState(false)
  const lines = useMemo(() => useStore.getState().text.split('\n'), [projection])
  if (!vault) return <p className="muted">{t('Abre una carpeta como vault.')}</p>
  const scene = projection.scenes.find((s) => cursorLine >= s.startLine && cursorLine < s.endLine)
  const resolved = new Set(files.map((f) => f.name.toLowerCase()))
  const seasons = new Map<string, typeof files>() // clave = número de temporada ('' = sin temporada)
  for (const f of files.filter((x) => x.kind === 'script')) {
    const d = docs.find((x) => x.path === f.path)
    const key = d ? String(readFrontmatter(d.content).data['season'] ?? '') : ''
    seasons.set(key, [...(seasons.get(key) ?? []), f])
  }
  const ql = q.toLowerCase()
  const groups = [...new Set(projection.scenes.map((s) => s.group).filter(Boolean))]
  const scenes = projection.scenes.filter(
    (s) =>
      (!groupFilter || s.group === groupFilter) &&
      (!ql || s.heading.toLowerCase().includes(ql) || (inContent && lines.slice(s.startLine, s.endLine).join('\n').toLowerCase().includes(ql)))
  )
  const toggleSel = (i: number) => setSel((prev) => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n })
  const runDelete = () => { deleteScenes([...sel]); setSel(new Set()) }

  // Cuerpo de cada sección de biblioteca por id.
  const body = (id: string) => {
    if (id === 'script') {
      return (
        <>
          {adding === 'script' && <NewFile kind="script" onDone={() => setAdding(null)} />}
          {[...seasons.entries()].sort().map(([season, list]) => (
            <div key={season || 'none'}>
              <div className="muted tiny">{season ? `${t('Temporada')} ${season}` : t('Sin temporada')}</div>
              <ul>{list.map((f) => <li key={f.path} className={f.path === path ? 'active' : ''} onClick={() => void openFile(f.path)}><span className="ell">{f.name}</span></li>)}</ul>
            </div>
          ))}
        </>
      )
    }
    const k = id as Exclude<FileKind, 'other'>
    return (
      <>
        {adding === k && <NewFile kind={k} onDone={() => setAdding(null)} />}
        <ul>{files.filter((f) => f.kind === k).map((f) => <li key={f.path} className={f.path === path ? 'active' : ''} onClick={() => void openFile(f.path)}><span className="ell">{f.name}</span></li>)}</ul>
      </>
    )
  }

  return (
    <>
      {/* Contextuales al documento abierto: fijas arriba. */}
      {path && projection.scenes.length > 0 && (
        <div className="block">
          <h2>
            {t('Escenas')} · {projection.scenes.length}
            <span className="grow" />
            <button className={multi ? 'mini on' : 'mini ghost'} title={t('Selección múltiple')} onClick={() => { setMulti((m) => !m); setSel(new Set()) }}>{t('Multi')}</button>
            {sceneTrash.length > 0 && <button className="mini ghost" title={t('Papelera de escenas')} onClick={() => setShowTrash((v) => !v)}><Icon name="trash" size={13} />{sceneTrash.length}</button>}
          </h2>
          <input placeholder={t('Buscar escena…')} value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="row tiny wrap">
            <label className="check tiny grow"><input type="checkbox" checked={inContent} onChange={(e) => setInContent(e.target.checked)} /> {t('también en contenido')}</label>
            {groups.length > 0 && (
              <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} title={t('Filtrar por grupo')}>
                <option value="">{t('Todos los grupos')}</option>
                {groups.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            )}
          </div>

          {showTrash && sceneTrash.length > 0 && (
            <div className="trashbox">
              <div className="muted tiny">{t('Papelera (sesión) · recuperación permanente en Versiones')}</div>
              {sceneTrash.map((tr, i) => (
                <div key={i} className="row tiny">
                  <span className="grow ell">{tr.heading || t('(sin encabezado)')}</span>
                  <button className="mini" onClick={() => restoreScene(i)}>{t('Restaurar')}</button>
                </div>
              ))}
            </div>
          )}

          {multi && (
            <div className="row tiny bulkbar">
              <span className="grow">{sel.size} {t('seleccionadas')}</span>
              <button className="mini" disabled={!sel.size} onClick={() => setSel(new Set(scenes.map((s) => s.index)))}>{t('Todas')}</button>
              <button className="mini del" disabled={!sel.size} onClick={runDelete}>{t('Eliminar')}</button>
            </div>
          )}

          <ul className="scenes">
            {scenes.map((s, i) => {
              const newGroupHere = s.group !== (scenes[i - 1]?.group ?? (i === 0 ? null : ''))
              return (
                <div key={s.index}>
                  {!groupFilter && newGroupHere && s.group && <li className="grouphead muted tiny"><span className="ell">{s.group}</span></li>}
                  <li className={s === scene ? 'active' : ''} onClick={() => (multi ? toggleSel(s.index) : setCursor(s.startLine, null))} title={`${s.wordCount} ${t('palabras')} · ≈${estimateTokens(lines.slice(s.startLine, s.endLine).join('\n'))} ${t('tokens')} · ${t('pág.')} ${pagination.lineToPage[s.startLine] ?? 1}\n${s.characters.join(', ')}`}>
                    {multi && <input type="checkbox" checked={sel.has(s.index)} onChange={() => toggleSel(s.index)} onClick={(e) => e.stopPropagation()} />}
                    <span className="muted">{s.index + 1}.</span> <span className="grow ell">{s.heading}</span>
                    {!multi && <>
                      <span className="mv" onClick={(e) => { e.stopPropagation(); moveScene(s.index, s.index - 1) }}>▲</span>
                      <span className="mv" onClick={(e) => { e.stopPropagation(); moveScene(s.index, s.index + 1) }}>▼</span>
                    </>}
                  </li>
                </div>
              )
            })}
          </ul>

          {newGroup === null ? (
            <button className="mini ghost" onClick={() => setNewGroup('')}>{t('+ grupo (sección) en la escena actual')}</button>
          ) : (
            <input autoFocus placeholder={t('Nombre del grupo · Enter')} value={newGroup} onChange={(e) => setNewGroup(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newGroup.trim()) { addGroup(newGroup); setNewGroup(null) } else if (e.key === 'Escape') setNewGroup(null) }} onBlur={() => setNewGroup(null)} />
          )}
        </div>
      )}
      {scene && (
        <div className="block">
          <h2>{t('En escena')}</h2>
          <ul>
            {scene.characters.map((c) => <li key={c}>{c}</li>)}
            {scene.links.map((l) => (
              <li key={l} className={resolved.has(l.toLowerCase()) ? '' : 'muted'}>
                [[{l}]]
                {!resolved.has(l.toLowerCase()) && <button className="mini" onClick={() => void createFile(`${roleDir('character')}/${l}.md`, TEMPLATE.character(l), false)}>{t('+ ficha')}</button>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* Biblioteca: secciones reordenables y plegables (arrastra la cabecera). */}
      {orderedSections(prefs.sectionOrder).map((id) => (
        <LibrarySection key={id} id={id} label={t(KIND_LABEL[id as FileKind])} onAdd={() => setAdding(id as Exclude<FileKind, 'other'>)}>
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
  const { scope, setScope, selection, text, cursorLine, projection, showTags, toggleTags, prefs, setPref, setTab, setDevTab } = useStore()
  const lines = text.split('\n')
  const scene = projection.scenes.find((s) => cursorLine >= s.startLine && cursorLine < s.endLine)
  const est =
    scope === 'range' && selection ? lines.slice(selection.from, selection.to).join('\n').length
    : scope === 'scene' && scene ? lines.slice(scene.startLine, scene.endLine).join('\n').length
    : scope === 'full' ? text.length : scope === 'outline' ? projection.scenes.length * 60 : 300
  return (
    <div className="scopebar">
      {SCOPES.map(([s, l]) => (
        <button key={s} className={s === scope ? 'on' : 'ghost'} disabled={s === 'range' && !selection} onClick={() => setScope(s)}>{t(l)}</button>
      ))}
      <span className="grow" />
      <button className={prefs.focus ? 'on mini' : 'mini ghost'} onClick={() => setPref('focus', !prefs.focus)} title={t('Modo enfoque: atenúa lo demás')}>{t('Enfoque')}</button>
      <button className={prefs.page ? 'on mini' : 'mini ghost'} onClick={() => setPref('page', !prefs.page)} title={t('Modo página: aspecto de hoja de guion')}>{t('Página')}</button>
      <button className={showTags ? 'on mini' : 'mini ghost'} onClick={toggleTags} title={t('Etiquetas de elemento')}>ABC</button>
      <span className="sep" />
      <button className="mini ghost" onClick={() => { setTab('dev'); setDevTab('beats') }} title="Beat Timeline">Beats</button>
      <button className="mini ghost" onClick={() => { setTab('dev'); setDevTab('map') }} title={t('Mapa neural')}>{t('Mapa')}</button>
      <button className="mini ghost" onClick={() => { setTab('dev'); setDevTab('analysis') }} title={t('Análisis')}>{t('Análisis')}</button>
      <span className="muted">≈ {Math.ceil(est / 4)} {t('tokens')}</span>
    </div>
  )
}

function RightPanel() {
  const s = useStore()
  const [tab, setTab] = useState<'ai' | 'versions' | 'export'>('ai')
  // Petición externa (menú Archivo → Exportar): abrir un panel concreto.
  useEffect(() => { if (s.deskPanel) { setTab(s.deskPanel); s.setDeskPanel(null) } }, [s.deskPanel]) // eslint-disable-line react-hooks/exhaustive-deps
  const [instruction, setInstruction] = useState('')
  const [allowLocked, setAllowLocked] = useState(false)
  const [label, setLabel] = useState('')
  const [compare, setCompare] = useState<{ id: string; content: string } | null>(null)
  const cfg = s.vault?.config
  const coverImg = useAsset(cfg?.cover.image ?? '')
  const locked = s.frontmatter['locked'] === true
  const name = s.path ? s.path.split('/').pop()!.replace(/\.md$/, '') : 'guion'
  const TAB_LABEL = { ai: t('Script Assistant'), versions: t('Versiones'), export: t('Exportar') }

  return (
    <>
      <div className="tabs">
        {(['ai', 'versions', 'export'] as const).map((tb) => (
          <button key={tb} className={tab === tb ? 'on' : 'ghost'} onClick={() => setTab(tb)}>{TAB_LABEL[tb]}</button>
        ))}
      </div>

      {tab === 'ai' && (
        <>
          <div className="block">
            <h2>{t('Instrucción')} · {t('scope')}: {t(SCOPES.find(([k]) => k === s.scope)?.[1] ?? '')}</h2>
            <textarea rows={4} placeholder={t('Ej. "Haz el diálogo de Rick más evasivo sin revelar la clave"')} value={instruction} onChange={(e) => setInstruction(e.target.value)} />
            {locked && (
              <label className="check"><input type="checkbox" checked={allowLocked} onChange={(e) => setAllowLocked(e.target.checked)} /> {t('Autorizo editar este archivo')} <code>locked</code></label>
            )}
            <button disabled={!s.path || s.aiBusy || !instruction.trim()} onClick={() => void s.runAi(instruction, allowLocked)}>{s.aiBusy ? t('Pensando…') : t('Proponer diff')}</button>
            {s.aiError && <p className="err">{s.aiError}</p>}
            {!s.keyStatus?.present && cfg?.byok.provider !== 'ollama' && <p className="muted tiny">{t('Sin clave BYOK: configúrala en Ajustes.')}</p>}
          </div>
          {s.proposal && (
            <div className="block">
              <h2>{t('Propuesta')} · {t('líneas')} {s.proposal.from + 1}-{s.proposal.to} · {s.proposal.tokensIn}→{s.proposal.tokensOut} {t('tokens')} · {s.proposal.model}</h2>
              <pre className="diff">
                {diffLines(s.proposal.target + '\n', s.proposal.replacement + '\n').map((p, i) => <span key={i} className={p.added ? 'add' : p.removed ? 'del' : ''}>{p.value}</span>)}
              </pre>
              {s.proposal.rationale && <p className="muted">{s.proposal.rationale}</p>}
              {s.proposal.docHash !== s.diskHash && <p className="err">{t('Obsoleta: el documento cambió desde la petición.')}</p>}
              <div className="row">
                <button disabled={s.proposal.docHash !== s.diskHash} onClick={() => void s.acceptProposal()}>{t('Aceptar')}</button>
                <button className="ghost" onClick={s.rejectProposal}>{t('Rechazar')}</button>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'versions' && (
        <div className="block">
          <h2>{t('Historial')} · {name}</h2>
          <div className="row">
            <input placeholder={t('Nombre del snapshot')} value={label} onChange={(e) => setLabel(e.target.value)} />
            <button className="mini" disabled={!s.path || !label.trim()} onClick={() => { void s.snapshot(label.trim()); setLabel('') }}>{t('Snapshot')}</button>
          </div>
          {s.versions.length === 0 && <p className="muted">{t('Sin versiones aún. Cada guardado que cambia el archivo crea un punto restaurable.')}</p>}
          <ul>
            {s.versions.map((v) => (
              <li key={v.id} className="row">
                <span className="ell">{new Date(v.ts).toLocaleString()} · {v.label ?? v.origin} · {v.bytes} B</span>
                <span className="grow" />
                <button className="mini ghost" onClick={() => void window.api.versionRead(s.path!, v.id).then((content) => setCompare({ id: v.id, content }))}>{t('Comparar')}</button>
                <button className="mini" onClick={() => void s.restoreVersion(v.id)}>{t('Restaurar')}</button>
              </li>
            ))}
          </ul>
          {compare && (
            <>
              <h2>{t('Versión → actual')} <button className="mini ghost" onClick={() => setCompare(null)}>{t('cerrar')}</button></h2>
              <pre className="diff">
                {diffLines(compare.content, s.text).filter((p) => p.added || p.removed).map((p, i) => <span key={i} className={p.added ? 'add' : 'del'}>{p.value}</span>)}
              </pre>
            </>
          )}
        </div>
      )}

      {tab === 'export' && (
        <div className="block">
          <h2>{t('Exportar')} {name}</h2>
          <div className="col">
            <button disabled={!s.path} onClick={() => {
              const vars = { title: cfg?.cover.title || name, episode: name, author: cfg?.cover.author }
              void window.api.exportPdf(
                mdToHtml(s.text, name, cfg ? { ...cfg.cover, imageDataUrl: coverImg } : undefined, cfg?.pdf),
                `${name}.pdf`,
                { paper: cfg?.pdf.paper ?? 'Letter', headerTemplate: pdfVars(cfg?.pdf.header ?? '', vars), footerTemplate: pdfVars(cfg?.pdf.footer ?? '', vars) }
              )
            }}>{t('PDF (formato industria')}{cfg?.cover.title ? t(' + portada') : ''})</button>
            <div className="row">
              <button disabled={!s.path} className="ghost" onClick={() => void window.api.exportBytes(toB64(mdToDocx(s.text)), `${name}.docx`)}>DOCX</button>
              <button disabled={!s.path} className="ghost" onClick={() => void window.api.exportText(mdToFdx(s.text), `${name}.fdx`)}>FDX</button>
              <button disabled={!s.path} className="ghost" onClick={() => void window.api.exportText(mdToFountain(s.text), `${name}.fountain`)}>Fountain</button>
              <button disabled={!s.path} className="ghost" onClick={() => void window.api.exportText(mdToTxt(s.text), `${name}.txt`)}>TXT</button>
            </div>
            <button className="ghost" onClick={() => void window.api.importScript().then((f) => f && s.refreshFiles().then(() => s.openFile(f.path)))}>{t('Importar .fountain / .fdx')}</button>
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
  // Ventana estrecha: el panel derecho cede primero y se pliega si queda por debajo de 240px; luego cede el izquierdo.
  // El editor conserva 360px.
  const cols = (l: number, r: number) => {
    const over = l + r + 372 - window.innerWidth
    if (over > 0) r = r - over < 240 ? 0 : r - over
    const over2 = l + r + 372 - window.innerWidth
    if (over2 > 0) l = Math.max(200, l - over2)
    mainRef.current?.classList.toggle('narrow', r === 0)
    return `${l}px 6px minmax(360px, 1fr) 6px ${r}px`
  }
  useEffect(() => {
    const apply = () => { if (mainRef.current) mainRef.current.style.gridTemplateColumns = cols(prefs.deskLeft, prefs.deskRight) }
    apply()
    window.addEventListener('resize', apply)
    return () => window.removeEventListener('resize', apply)
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
      <div className="resizer" onPointerDown={resizer('left')} title={t('Arrastra para redimensionar')} />
      <section>
        {s.conflict && (
          <div className="banner">
            {t('El archivo cambió en disco mientras lo editabas.')}
            <button className="mini" onClick={() => void s.reloadFromDisk()}>{t('Recargar del disco')}</button>
            <button className="mini ghost" onClick={() => void s.save(true)}>{t('Conservar lo mío')}</button>
          </div>
        )}
        {s.path ? (
          <>
            <ScopeBar />
            <Editor />
          </>
        ) : (
          <p className="muted center">{t('Selecciona o crea un archivo. Ctrl+clic en un [[enlace]] abre la ficha.')}</p>
        )}
      </section>
      <div className="resizer" onPointerDown={resizer('right')} title={t('Arrastra para redimensionar')} />
      <aside className="right"><RightPanel /></aside>
    </main>
  )
}
