import { useMemo, useState } from 'react'
import { breakdown, extractMissing, toCsv, type Appearance, type EntityCard } from '../../core/breakdown'
import { readFrontmatter, writeFrontmatter } from '../../core/frontmatter'
import { extractLinks } from '../../core/parser/fountain'
import type { FileKind } from '../../core/types/ipc'
import { t } from '../i18n'
import { useStore } from '../store'
import { Icon, BlurInput, useAsset } from '../ui'
import { TEMPLATE } from './Desk'

const GROUP_META: Record<string, { label: string; color: string }> = {
  protagonist: { label: 'Protagonistas', color: '#4f8cff' },
  supporting: { label: 'Secundarios', color: '#3ddc97' },
  antagonist: { label: 'Antagonistas', color: '#e8437f' },
  extra: { label: 'Extras', color: '#c47d1a' },
  none: { label: 'Sin grupo', color: 'var(--dim)' }
}
const BASE_GROUPS = ['protagonist', 'supporting', 'antagonist', 'extra']
const groupColor = (g: string) => GROUP_META[g]?.color ?? '#8b91a0'
const groupLabel = (g: string) => (GROUP_META[g] ? t(GROUP_META[g]!.label) : g)
const VIA_COLOR: Record<Appearance['via'], string> = { cue: '#3ddc97', link: '#4f8cff', heading: '#c47d1a' }
const VIA_LABEL: Record<Appearance['via'], string> = { cue: 'en escena', link: 'mención', heading: 'encabezado' }

let dragCard: string | null = null // ficha en arrastre (clasificar soltando en un grupo)

type MenuItem = { label: string; run: () => void; danger?: boolean; disabled?: boolean } | 'sep'
// Menú "…" (tarjeta o vista): acciones secundarias fuera de la barra.
function Menu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="cardmenu">
      <button className="mini ghost" title={t('Más acciones')} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}><Icon name="more" size={12} /></button>
      {open && (
        <div className="menu" role="menu" onMouseLeave={() => setOpen(false)}>
          {items.map((it, i) => it === 'sep' ? <div key={i} className="menu-sep" /> : (
            <button key={i} className={`menu-item ${it.danger ? 'danger' : ''}`} disabled={it.disabled} onClick={() => { setOpen(false); it.run() }}>{it.label}</button>
          ))}
        </div>
      )}
    </div>
  )
}

// Ficha de lugar (PRD §42, Location Engine): campos propios del espacio narrativo, en el frontmatter de la locación.
const LOC_FIELDS: [string, string][] = [
  ['type', 'Tipo (interior, ciudad, nave…)'],
  ['region', 'Región o mundo'],
  ['atmosphere', 'Atmósfera: luz, sonido, olor…'],
  ['purpose', 'Propósito narrativo: ¿por qué aquí?'],
  ['symbolism', 'Simbolismo'],
  ['secrets', 'Secretos del lugar']
]

function Card({ c, groups, epOf, places = [], refs = 0 }: { c: EntityCard; groups: string[]; epOf: (s: string) => string; places?: string[]; refs?: number }) {
  const { docs, writeOther, openFile, setTab, files, deleteEntity, openRename } = useStore()
  const img = useAsset(c.image)
  const [expand, setExpand] = useState(false)
  const [sheet, setSheet] = useState(false)
  const doc = docs.find((d) => d.path === c.path)
  const data = doc ? readFrontmatter(doc.content).data : {}
  const patch = (p: Record<string, unknown>) => doc && void writeOther(c.path, writeFrontmatter(doc.content, p))
  const scripts = files.filter((f) => f.kind === 'script')
  const episodes = new Set(c.appearances.map((a) => epOf(a.script)).filter(Boolean)).size
  const shown = expand ? c.appearances : c.appearances.slice(0, 14)
  // Borrado con recuento de referencias (PRD §163): el usuario ve qué pierde antes de confirmar.
  const del = () => {
    const uses = c.appearances.length + refs
    const detail = uses ? `${t('Referenciado en')} ${c.appearances.length} ${t('escena(s)')}${refs ? ` ${t('y')} ${refs} ${t('ficha(s)')}` : ''}. ` : ''
    if (window.confirm(`${t('¿Eliminar')} "${c.name}"? ${detail}${t('(recuperable en Versiones)')}`)) void deleteEntity(c.path)
  }
  return (
    <div className="card" draggable onDragStart={() => (dragCard = c.path)} onDragEnd={() => (dragCard = null)}>
      <div className="row">
        <div className="avatar" onClick={() => void window.api.assetPick().then((rel) => rel && patch({ image: rel }))} title={t('Cambiar foto')}>
          {img ? <img src={img} alt="" /> : <span>{c.name.slice(0, 1)}</span>}
        </div>
        <div className="grow">
          <div className="tiny muted ell">{c.kind}{data['parent'] ? ` · ${t('en')} ${String(data['parent'])}` : ''}</div>
          <strong className="link" onClick={() => { void openFile(c.path); setTab('desk') }}>{c.name}</strong>
        </div>
        <Menu items={[{ label: t('Abrir .md'), run: () => { void openFile(c.path); setTab('desk') } }, { label: t('Renombrar…'), run: () => openRename(c.path, c.name, [c.name, ...c.aliases]) }, 'sep', { label: t('Eliminar'), run: del, danger: true }]} />
      </div>
      {c.kind === 'character' && (
        <div className="row">
          <span className="chip" style={{ color: groupColor(c.group), borderColor: groupColor(c.group) }}>{groupLabel(c.group)}</span>
          <select value={groups.includes(c.group) ? c.group : 'none'} onChange={(e) => patch({ group: e.target.value })}>
            <option value="none">{t('Sin grupo')}</option>
            {groups.map((g) => <option key={g} value={g}>{groupLabel(g)}</option>)}
          </select>
        </div>
      )}
      <BlurInput textarea rows={2} value={c.description} placeholder={t('Descripción')} onCommit={(v) => patch({ description: v })} />
      <BlurInput value={c.aliases.join(', ')} placeholder={t('Alias separados por comas')} onCommit={(v) => patch({ aliases: v.split(',').map((x) => x.trim()).filter(Boolean) })} />
      {c.kind === 'location' && (
        <>
          <div className="row tiny">
            <span className="muted">{t('Dentro de')}</span>
            <select value={String(data['parent'] ?? '')} onChange={(e) => patch({ parent: e.target.value })}>
              <option value="">—</option>
              {places.filter((p) => p !== c.name).map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <span className="grow" />
            <button className="mini ghost" onClick={() => setSheet((s) => !s)}>{t('Ficha de lugar')}</button>
          </div>
          {sheet && LOC_FIELDS.map(([k, ph]) => <BlurInput key={k} value={String(data[k] ?? '')} placeholder={t(ph)} onCommit={(v) => patch({ [k]: v })} />)}
        </>
      )}
      <div className="tiny muted">{c.appearances.length} {t('escenas')} · {episodes} {t('episodios')}{c.kind === 'character' ? ` · ${c.words} ${t('palabras')}` : ''}</div>
      <div className="chips">
        {shown.map((a, i) => (
          <span key={i} className="chip" title={`${a.heading} · ${t(VIA_LABEL[a.via])}`} style={{ color: VIA_COLOR[a.via], borderColor: VIA_COLOR[a.via], borderStyle: a.via === 'link' ? 'dashed' : 'solid' }} onClick={() => {
            const sc = docs.find((d) => d.path === a.script)
            const line = sc ? sc.content.split('\n').findIndex((l, idx) => idx > 0 && l.trim().toUpperCase() === a.heading.toUpperCase()) : 0
            void openFile(a.script, Math.max(0, line)); setTab('desk')
          }}>{scripts.length > 1 ? `${a.script.split('/').pop()!.replace(/\.md$/, '').slice(0, 6)}·` : ''}{a.scene + 1}</span>
        ))}
        {c.appearances.length > 14 && <button className="mini ghost" onClick={() => setExpand((e) => !e)}>{expand ? t('– menos') : `+${c.appearances.length - 14}`}</button>}
        {c.appearances.length === 0 && <span className="muted tiny">{t('sin conexión al guion')}</span>}
      </div>
    </div>
  )
}

export function Breakdown() {
  const { files, docs, createFile, writeOther, deleteEntity, roleDir } = useStore()
  const [kind, setKind] = useState<FileKind>('character')
  const [group, setGroup] = useState('all')
  const [q, setQ] = useState('')
  const [newName, setNewName] = useState('')
  const [newGroup, setNewGroup] = useState<string | null>(null)
  const [extraGroups, setExtraGroups] = useState<string[]>([])
  const [orphansOnly, setOrphansOnly] = useState(false)
  const [season, setSeason] = useState('')
  const [episode, setEpisode] = useState('')
  const [sortBy, setSortBy] = useState('added')
  const [listView, setListView] = useState(false)
  const [over, setOver] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const cards = useMemo(() => breakdown(files, docs), [files, docs])
  const missing = useMemo(() => extractMissing(files, docs), [files, docs])
  const places = useMemo(() => cards.filter((c) => c.kind === 'location').map((c) => c.name), [cards])
  // Menciones [[ ]] por nombre: alimentan el recuento de referencias del borrado (PRD §163).
  const links = useMemo(() => {
    const m = new Map<string, number>()
    for (const d of docs) for (const l of extractLinks(d.content)) m.set(l.toLowerCase(), (m.get(l.toLowerCase()) ?? 0) + 1)
    return m
  }, [docs])
  const refsOf = (c: EntityCard) => [c.name, ...c.aliases].reduce((a, n) => a + (links.get(n.toLowerCase()) ?? 0), 0)

  const scriptMeta = useMemo(() => new Map(files.filter((f) => f.kind === 'script').map((f) => {
    const fm = readFrontmatter(docs.find((d) => d.path === f.path)?.content ?? '').data
    return [f.path, { season: String(fm['season'] ?? ''), episode: String(fm['episode'] ?? '') }] as const
  })), [files, docs])
  const epOf = (s: string) => scriptMeta.get(s)?.episode ?? ''
  const seasons = [...new Set([...scriptMeta.values()].map((m) => m.season).filter(Boolean))].sort()
  const episodes = [...new Set([...scriptMeta.values()].filter((m) => !season || m.season === season).map((m) => m.episode).filter(Boolean))].sort((a, b) => Number(a) - Number(b))

  const ofKind = cards.filter((c) => c.kind === kind)
  const customGroups = [...new Set([...ofKind.map((c) => c.group).filter((g) => g && g !== 'none' && !BASE_GROUPS.includes(g)), ...extraGroups])]
  const allGroups = [...BASE_GROUPS, ...customGroups]
  const countIn = (g: string) => ofKind.filter((c) => (g === 'none' ? !c.group || c.group === 'none' : c.group === g)).length
  const inScope = (c: EntityCard) => (!season && !episode) || c.appearances.some((a) => { const m = scriptMeta.get(a.script); return (!season || m?.season === season) && (!episode || m?.episode === episode) })

  // Jerarquía de lugares (PRD §43): cada ficha declara `parent`; los huérfanos cuelgan de la raíz.
  const parentOf = (c: EntityCard) => String(readFrontmatter(docs.find((d) => d.path === c.path)?.content ?? '').data['parent'] ?? '')
  const tree = (l: EntityCard[]): { c: EntityCard; depth: number }[] => {
    const byName = new Map(l.map((c) => [c.name, c]))
    const kids = new Map<string, EntityCard[]>()
    const roots: EntityCard[] = []
    for (const c of [...l].sort((a, b) => a.name.localeCompare(b.name))) {
      const p = parentOf(c)
      if (p && byName.has(p) && p !== c.name) kids.set(p, [...(kids.get(p) ?? []), c])
      else roots.push(c)
    }
    const out: { c: EntityCard; depth: number }[] = []
    const walk = (c: EntityCard, depth: number) => { out.push({ c, depth }); if (depth < 6) for (const k of kids.get(c.name) ?? []) walk(k, depth + 1) }
    for (const r of roots) walk(r, 0)
    return out
  }

  const list = useMemo(() => {
    let l = ofKind.filter((c) =>
      (group === 'all' || (group === 'none' ? !c.group || c.group === 'none' : c.group === group)) &&
      (!orphansOnly || c.appearances.length === 0) &&
      inScope(c) &&
      (!q || c.name.toLowerCase().includes(q.toLowerCase())))
    if (sortBy === 'az') l = [...l].sort((a, b) => a.name.localeCompare(b.name))
    else if (sortBy === 'scenes') l = [...l].sort((a, b) => b.appearances.length - a.appearances.length)
    else if (sortBy === 'group') l = [...l].sort((a, b) => a.group.localeCompare(b.group))
    else if (sortBy === 'tree' && kind === 'location') return tree(l)
    return l.map((c) => ({ c, depth: 0 }))
  }, [ofKind, group, orphansOnly, season, episode, q, sortBy, kind, docs])

  const patchGroup = (path: string, g: string) => { const d = docs.find((x) => x.path === path); if (d) void writeOther(path, writeFrontmatter(d.content, { group: g })) }
  const extract = async () => {
    for (const n of missing.characters) await createFile(`${roleDir('character')}/${n}.md`, TEMPLATE.character(n), false)
    for (const n of missing.locations) await createFile(`${roleDir('location')}/${n}.md`, TEMPLATE.location(n), false)
  }
  const add = () => {
    if (!newName.trim() || kind === 'script' || kind === 'other') return
    void createFile(`${roleDir(kind)}/${newName.trim()}.md`, TEMPLATE[kind](newName.trim()), false)
    setNewName('')
  }
  // Auto-clasifica personajes sin grupo por nº de apariciones (determinista, reversible; sin IA silenciosa).
  const autoClassify = async () => {
    const chars = cards.filter((c) => c.kind === 'character')
    const max = Math.max(1, ...chars.map((c) => c.appearances.length))
    let n = 0
    for (const c of chars) {
      if (c.group && c.group !== 'none') continue
      const r = c.appearances.length / max
      const g = c.appearances.length === 0 ? '' : r >= 0.6 ? 'protagonist' : r >= 0.25 ? 'supporting' : 'extra'
      if (g) { const d = docs.find((x) => x.path === c.path); if (d) { await writeOther(c.path, writeFrontmatter(d.content, { group: g })); n++ } }
    }
    setStatus(`${n} ${t('clasificadas')}`)
  }
  const deleteAll = async () => {
    if (!window.confirm(`${t('¿Eliminar las')} ${list.length} ${t('fichas visibles? (recuperables en Versiones)')}`)) return
    for (const { c } of list) await deleteEntity(c.path)
  }
  const toXls = () => {
    const esc = (s: string) => s.replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]!))
    const rows = list.map(({ c }) => `<tr><td>${esc(c.name)}</td><td>${esc(groupLabel(c.group))}</td><td>${esc(c.actor)}</td><td>${c.appearances.length}</td><td>${esc(c.aliases.join('; '))}</td></tr>`).join('')
    const html = `<table border=1><tr><th>Name</th><th>Group</th><th>Actor</th><th>Scenes</th><th>Aliases</th></tr>${rows}</table>`
    void window.api.exportText(html, `${kind}.xls`)
  }

  const inScript = ofKind.filter((c) => c.appearances.length > 0).length
  const orphans = ofKind.length - inScript

  return (
    <main className="split bd">
      <aside className="bd-groups">
        <div className="row"><h2>{t('Grupos')}</h2><span className="grow" /><button className="mini ghost" title={t('Nuevo grupo')} onClick={() => setNewGroup('')}><Icon name="plus" size={12} /></button></div>
        <ul>
          <li className={group === 'all' ? 'active' : ''} onClick={() => setGroup('all')}><span className="grow">{t('Todos')}</span><span className="muted tiny">{ofKind.length}</span></li>
          {allGroups.map((g) => (
            <li key={g} className={`${group === g ? 'active' : ''} ${over === g ? 'dragover' : ''}`} onClick={() => setGroup(g)}
              onDragOver={(e) => { e.preventDefault(); setOver(g) }} onDragLeave={() => setOver(null)} onDrop={() => { setOver(null); if (dragCard) patchGroup(dragCard, g) }}>
              <span className="cdot" style={{ background: groupColor(g) }} /><span className="grow ell">{groupLabel(g)}</span><span className="muted tiny">{countIn(g)}</span>
            </li>
          ))}
          <li className={`${group === 'none' ? 'active' : ''} ${over === 'none' ? 'dragover' : ''}`} onClick={() => setGroup('none')}
            onDragOver={(e) => { e.preventDefault(); setOver('none') }} onDragLeave={() => setOver(null)} onDrop={() => { setOver(null); if (dragCard) patchGroup(dragCard, 'none') }}>
            <span className="grow">{t('Sin grupo')}</span><span className="muted tiny">{countIn('none')}</span>
          </li>
        </ul>
        {newGroup !== null && (
          <input autoFocus placeholder={t('Nuevo grupo · Enter')} value={newGroup} onChange={(e) => setNewGroup(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && newGroup.trim()) { setExtraGroups((s) => [...new Set([...s, newGroup.trim()])]); setGroup(newGroup.trim()); setNewGroup(null) } else if (e.key === 'Escape') setNewGroup(null) }} onBlur={() => setNewGroup(null)} />
        )}
        <p className="muted tiny" style={{ marginTop: 10 }}>{t('Arrastra una ficha a un grupo para clasificarla.')}</p>
      </aside>

      <section className="scroll">
        <div className="toolbar wrap">
          {(['character', 'location', 'prop'] as FileKind[]).map((k) => (
            <button key={k} className={kind === k ? 'on' : 'ghost'} onClick={() => { setKind(k); setGroup('all') }}>{t({ character: 'Personajes', location: 'Locaciones', prop: 'Ítems' }[k as 'character'])} ({cards.filter((c) => c.kind === k).length})</button>
          ))}
          <span className="sep" />
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} title={t('Orden')}>
            <option value="added">{t('Orden de adición')}</option>
            <option value="az">A-Z</option>
            <option value="scenes">{t('Por escenas')}</option>
            <option value="group">{t('Por grupo')}</option>
            {kind === 'location' && <option value="tree">{t('Por jerarquía')}</option>}
          </select>
          <div className="segmented" role="group" title={t('Vista')}>
            <button className={listView ? '' : 'on'} onClick={() => setListView(false)}>{t('Tarjetas')}</button>
            <button className={listView ? 'on' : ''} onClick={() => setListView(true)}>{t('Lista')}</button>
          </div>
          <select value={season} onChange={(e) => { setSeason(e.target.value); setEpisode('') }} title={t('Temporada')}><option value="">{t('Todas')}</option>{seasons.map((s) => <option key={s} value={s}>{`S${s}`}</option>)}</select>
          <select value={episode} onChange={(e) => setEpisode(e.target.value)} title={t('Episodio')}><option value="">{t('Todos')}</option>{episodes.map((ep) => <option key={ep} value={ep}>{`E${ep}`}</option>)}</select>
          <input placeholder={t('Buscar…')} value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="grow" />
          <span className="pill" title={t('Total')}>{ofKind.length}</span>
          <span className="pill ok" title={t('Aparecen en el guion')}>{inScript} {t('en guion')}</span>
          <span className={`pill ${orphansOnly ? 'on' : 'warn'}`} title={t('Sin conexión al guion')} onClick={() => setOrphansOnly((v) => !v)} style={{ cursor: 'pointer' }}>{orphans} {t('sin conectar')}</span>
        </div>
        <div className="toolbar wrap tiny">
          {kind === 'character' && <button className="ghost" onClick={() => void autoClassify()}>{t('Auto-clasificar')}</button>}
          <button className="ghost" disabled={!missing.characters.length && !missing.locations.length} onClick={() => void extract()} title={[...missing.characters, ...missing.locations].join(', ')}>{t('Extraer del guión')} ({missing.characters.length + missing.locations.length})</button>
          <input placeholder={t('Nuevo…')} value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <span className="grow" />
          {status && <span className="muted tiny">{status}</span>}
          <Menu items={[{ label: t('Exportar Excel'), run: toXls }, { label: t('Exportar CSV'), run: () => void window.api.exportText(toCsv(cards), 'breakdown.csv') }, 'sep', { label: t('Eliminar todo'), run: () => void deleteAll(), danger: true, disabled: !list.length }]} />
        </div>
        <div className={listView ? 'bd-list' : 'cards'}>
          {list.map(({ c, depth }) => <div key={c.path} style={depth ? { marginLeft: depth * 18 } : undefined}><Card c={c} groups={allGroups} epOf={epOf} places={places} refs={refsOf(c)} /></div>)}
          {list.length === 0 && <p className="muted">{t('Sin fichas. Usa "Extraer del guión" o crea una.')}</p>}
        </div>
      </section>
    </main>
  )
}
