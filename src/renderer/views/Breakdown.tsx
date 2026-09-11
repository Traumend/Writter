import { useMemo, useState } from 'react'
import { breakdown, extractMissing, toCsv, type EntityCard } from '../../core/breakdown'
import { writeFrontmatter } from '../../core/frontmatter'
import { KIND_DIR, type FileKind } from '../../core/types/ipc'
import { useStore } from '../store'
import { BlurInput, useAsset } from '../ui'
import { TEMPLATE } from './Desk'

const GROUPS = ['none', 'protagonist', 'supporting', 'antagonist', 'extra']
const GROUP_LABEL: Record<string, string> = { none: 'Sin grupo', protagonist: 'Protagonistas', supporting: 'Secundarios', antagonist: 'Antagonistas', extra: 'Extras' }

function Card({ c }: { c: EntityCard }) {
  const { docs, writeOther, openFile, setTab, files } = useStore()
  const img = useAsset(c.image)
  const doc = docs.find((d) => d.path === c.path)
  const patch = (p: Record<string, unknown>) => doc && void writeOther(c.path, writeFrontmatter(doc.content, p))
  const scripts = files.filter((f) => f.kind === 'script')
  return (
    <div className="card">
      <div className="row">
        <div className="avatar" onClick={() => void window.api.assetPick().then((rel) => rel && patch({ image: rel }))} title="Cambiar foto">
          {img ? <img src={img} alt="" /> : <span>{c.name.slice(0, 1)}</span>}
        </div>
        <div className="grow">
          <div className="tiny muted">{c.kind}</div>
          <strong className="link" onClick={() => { void openFile(c.path); setTab('desk') }}>{c.name}</strong>
          {c.kind === 'character' && <BlurInput value={c.actor} placeholder="Actor no asignado" onCommit={(v) => patch({ actor: v })} />}
        </div>
      </div>
      {c.kind === 'character' && (
        <select value={c.group} onChange={(e) => patch({ group: e.target.value })}>
          {GROUPS.map((g) => <option key={g} value={g}>{GROUP_LABEL[g]}</option>)}
        </select>
      )}
      <BlurInput textarea rows={2} value={c.description} placeholder="Descripción" onCommit={(v) => patch({ description: v })} />
      <BlurInput value={c.aliases.join(', ')} placeholder="Alias separados por comas" onCommit={(v) => patch({ aliases: v.split(',').map((x) => x.trim()).filter(Boolean) })} />
      <div className="tiny muted">{c.appearances.length} escenas{c.kind === 'character' ? ` · ${c.words} palabras de diálogo` : ''}</div>
      <div className="chips">
        {c.appearances.map((a, i) => (
          <span key={i} className="chip" title={`${a.script}: ${a.heading}`} onClick={() => {
            const sc = docs.find((d) => d.path === a.script)
            const line = sc ? sc.content.split('\n').findIndex((l, idx) => idx > 0 && l.trim().toUpperCase() === a.heading.toUpperCase()) : 0
            void openFile(a.script, Math.max(0, line))
            setTab('desk')
          }}>{scripts.length > 1 ? `${a.script.split('/').pop()!.replace(/\.md$/, '').slice(0, 6)}·` : ''}{a.scene + 1}</span>
        ))}
      </div>
    </div>
  )
}

export function Breakdown() {
  const { files, docs, createFile } = useStore()
  const [kind, setKind] = useState<FileKind>('character')
  const [group, setGroup] = useState('all')
  const [q, setQ] = useState('')
  const [newName, setNewName] = useState('')
  const cards = useMemo(() => breakdown(files, docs), [files, docs])
  const missing = useMemo(() => extractMissing(files, docs), [files, docs])
  const list = cards
    .filter((c) => c.kind === kind && (group === 'all' || c.group === group) && (!q || c.name.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => b.appearances.length - a.appearances.length)
  const extract = async () => {
    for (const n of missing.characters) await createFile(`${KIND_DIR.character}/${n}.md`, TEMPLATE.character(n), false)
    for (const n of missing.locations) await createFile(`${KIND_DIR.location}/${n}.md`, TEMPLATE.location(n), false)
  }
  const add = () => {
    if (!newName.trim() || kind === 'script' || kind === 'other') return
    void createFile(`${KIND_DIR[kind]}/${newName.trim()}.md`, TEMPLATE[kind](newName.trim()), false)
    setNewName('')
  }
  return (
    <main className="page">
      <div className="toolbar">
        {(['character', 'location', 'prop'] as FileKind[]).map((k) => (
          <button key={k} className={kind === k ? 'on' : 'ghost'} onClick={() => setKind(k)}>{{ character: 'Personajes', location: 'Locaciones', prop: 'Ítems' }[k as 'character']} ({cards.filter((c) => c.kind === k).length})</button>
        ))}
        {kind === 'character' && (
          <select value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="all">Todos los grupos</option>
            {GROUPS.map((g) => <option key={g} value={g}>{GROUP_LABEL[g]}</option>)}
          </select>
        )}
        <input placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="grow" />
        <input placeholder="Nuevo…" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="ghost" disabled={!missing.characters.length && !missing.locations.length} onClick={() => void extract()} title={[...missing.characters, ...missing.locations].join(', ')}>
          Extraer del guión ({missing.characters.length + missing.locations.length})
        </button>
        <button className="ghost" onClick={() => void window.api.exportText(toCsv(cards), 'breakdown.csv')}>CSV</button>
      </div>
      <div className="cards">
        {list.map((c) => <Card key={c.path} c={c} />)}
        {list.length === 0 && <p className="muted">Sin fichas. Usa "Extraer del guión" o crea una.</p>}
      </div>
    </main>
  )
}
