import { useMemo, useState } from 'react'
import { breakdown } from '../../core/breakdown'
import { readFrontmatter, writeFrontmatter } from '../../core/frontmatter'
import { parseFountain } from '../../core/parser/fountain'
import { useStore } from '../store'
import { AiSuggest, BlurInput, Field, useAsset } from '../ui'

const TRAITS: [string, string, string, string, string][] = [
  ['initiative', 'Iniciativa', 'Reactivo', 'Proactivo', '#ff5a1f'],
  ['empathy', 'Empatía', 'Distante', 'Cercano', '#3ddc97'],
  ['moral_ambiguity', 'Ambigüedad moral', 'Claro', 'Ambiguo', '#c47d1a'],
  ['inner_conflict', 'Conflicto interno', 'Sereno', 'Roto por dentro', '#e8437f'],
  ['volatility', 'Volatilidad', 'Estable', 'Explosivo', '#f5c542'],
  ['transformation', 'Transformación', 'Sin cambio', 'Transformado', '#4f8cff'],
  ['mystery', 'Misterio', 'Transparente', 'Enigma', '#b388ff']
]
const SEL: [string, string, string[]][] = [
  ['role', 'Rol narrativo', ['Protagonista', 'Antagonista', 'Antihéroe', 'Mentor', 'Aliado', 'Interés romántico', 'Comic relief', 'Secundario']],
  ['importance', 'Importancia', ['Principal', 'Secundario', 'Recurrente', 'Episódico', 'Extra']],
  ['arc', 'Tipo de arco', ['Positivo', 'Negativo', 'Plano', 'Corrupción', 'Redención', 'Desilusión']],
  ['status', 'Estado', ['Vivo', 'Muerto', 'Desaparecido', 'Desconocido']],
  ['gender', 'Género', ['Masculino', 'Femenino', 'No binario', 'Otro']],
  ['age', 'Edad', ['Niño', 'Adolescente', 'Joven adulto', 'Adulto', 'Mayor (65+)']]
]
type Rel = { target: string; kind: string; note: string }

export function Characters() {
  const { files, docs, writeOther, openFile, setTab } = useStore()
  const cards = useMemo(() => breakdown(files, docs).filter((c) => c.kind === 'character').sort((a, b) => b.appearances.length - a.appearances.length), [files, docs])
  const [sel, setSel] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const path = sel ?? cards[0]?.path ?? null
  const card = cards.find((c) => c.path === path)
  const doc = docs.find((d) => d.path === path)
  const img = useAsset(card?.image ?? '')
  const { data, body } = doc ? readFrontmatter(doc.content) : { data: {}, body: '' }
  const traits = (data['traits'] as Record<string, number> | undefined) ?? {}
  const rels = (Array.isArray(data['relationships']) ? data['relationships'] : []) as Rel[]
  const str = (k: string) => String(data[k] ?? '')
  const patch = (p: Record<string, unknown>) => doc && void writeOther(doc.path, writeFrontmatter(doc.content, p))
  const setBody = (b: string) => doc && void writeOther(doc.path, `${doc.content.slice(0, doc.content.length - body.length)}${b}`)

  // Contexto para IA: escenas donde aparece + sus parlamentos (acotado), no el vault entero.
  const context = useMemo(() => {
    if (!card) return ''
    const out: string[] = [`Personaje: ${card.name}. Alias: ${card.aliases.join(', ') || '—'}.`]
    let budget = 6000
    for (const a of card.appearances) {
      const d = docs.find((x) => x.path === a.script)
      if (!d) continue
      const toks = parseFountain(d.content).tokens
      const h = toks.find((t) => t.type === 'heading' && t.text.trim().toUpperCase() === a.heading.toUpperCase())
      if (!h) continue
      let speaking = false
      const lines: string[] = [a.heading]
      for (const t of toks.slice(h.line + 1)) {
        if (t.type === 'heading') break
        if (t.type === 'character') speaking = [card.name, ...card.aliases].some((n) => t.text.toUpperCase().includes(n.toUpperCase()))
        if ((t.type === 'dialogue' && speaking) || t.type === 'action') lines.push(t.text.trim())
      }
      const chunk = lines.join('\n').slice(0, 900)
      budget -= chunk.length
      if (budget < 0) break
      out.push(chunk)
    }
    return out.join('\n\n')
  }, [card, docs])

  return (
    <main className="split">
      <aside>
        <h2>Personajes</h2>
        <input placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
        <ul>
          {cards.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase())).map((c) => (
            <li key={c.path} className={c.path === path ? 'active' : ''} onClick={() => setSel(c.path)}>
              {c.name} <span className="muted tiny">{c.appearances.length} esc.</span>
            </li>
          ))}
        </ul>
      </aside>
      {card && doc ? (
        <section className="scroll">
          <div className="hero">
            <div className="avatar big" onClick={() => void window.api.assetPick().then((rel) => rel && patch({ image: rel }))}>{img ? <img src={img} alt="" /> : <span>{card.name.slice(0, 1)}</span>}</div>
            <div className="grow">
              <h1>{card.name}</h1>
              <div className="row tiny muted"><span>Alias:</span><BlurInput value={card.aliases.join(', ')} placeholder="alias, alias" onCommit={(v) => patch({ aliases: v.split(',').map((x) => x.trim()).filter(Boolean) })} /></div>
              <Field label="Logline"><BlurInput textarea rows={2} value={str('logline')} onCommit={(v) => patch({ logline: v })} /></Field>
              <AiSuggest instruction="Escribe un logline de una o dos frases para este personaje, en español." context={context} onAccept={(t) => patch({ logline: t })} />
            </div>
            <button className="ghost" onClick={() => { void openFile(card.path); setTab('desk') }}>Abrir .md</button>
          </div>

          <h2>Información básica</h2>
          <div className="grid6">
            {SEL.map(([k, l, opts]) => (
              <Field key={k} label={l}>
                <select value={str(k)} onChange={(e) => patch({ [k]: e.target.value })}>
                  <option value="">—</option>
                  {opts.map((o) => <option key={o}>{o}</option>)}
                </select>
              </Field>
            ))}
            <Field label="Ocupación"><BlurInput value={str('occupation')} onCommit={(v) => patch({ occupation: v })} /></Field>
            <Field label="Origen / cultura"><BlurInput value={str('origin')} onCommit={(v) => patch({ origin: v })} /></Field>
          </div>

          <h2>Apariencia</h2>
          {/* div contenedor: evita que el textarea colapse como hijo directo del section flex-column */}
          <div><BlurInput textarea rows={5} value={str('appearance')} placeholder="Casting, vestuario, marcas visibles…" onCommit={(v) => patch({ appearance: v })} /></div>
          <AiSuggest instruction="Describe la apariencia física y el vestuario de este personaje en un párrafo, solo con lo que el guión soporte." context={context} onAccept={(t) => patch({ appearance: t })} />

          <h2>Biografía · {body.trim().split(/\s+/).filter(Boolean).length} palabras</h2>
          <div><BlurInput textarea rows={14} value={body.replace(/^\n+/, '')} placeholder="Biografía en prosa (cuerpo del .md)" onCommit={(v) => setBody('\n' + v + '\n')} /></div>
          <AiSuggest instruction="Escribe una biografía breve (100-150 palabras) de este personaje basada en las escenas." context={context} onAccept={(t) => setBody('\n' + t + '\n')} />

          <h2>Want / Need</h2>
          <div className="grid2">
            <Field label="Quiere (externo)"><BlurInput textarea rows={2} value={str('want')} onCommit={(v) => patch({ want: v })} /></Field>
            <Field label="Necesita (interno)"><BlurInput textarea rows={2} value={str('need')} onCommit={(v) => patch({ need: v })} /></Field>
          </div>
          <AiSuggest instruction='Responde en dos líneas: "Quiere: …" (deseo externo) y "Necesita: …" (necesidad interna).' context={context} onAccept={(t) => {
            const w = /Quiere:\s*(.*)/i.exec(t)?.[1] ?? ''
            const n = /Necesita:\s*(.*)/i.exec(t)?.[1] ?? ''
            patch({ want: w.trim(), need: n.trim() })
          }} />
        </section>
      ) : <section><p className="muted center">Sin personajes. Créalos en Breakdown.</p></section>}
      {card && doc && (
        <aside className="right scroll">
          <h2>Perfil creativo</h2>
          {TRAITS.map(([k, l, lo, hi, color]) => (
            <div className="slider" key={k}>
              <div className="row"><span>{l}</span><span className="grow" /><strong style={{ color }}>{traits[k] ?? 50}</strong></div>
              <input type="range" min={0} max={100} value={traits[k] ?? 50} style={{ accentColor: color }} onChange={(e) => patch({ traits: { ...traits, [k]: Number(e.target.value) } })} />
              <div className="row tiny muted"><span>{lo}</span><span className="grow" /><span>{hi}</span></div>
            </div>
          ))}

          <h2>Relaciones · {rels.length}</h2>
          <RelMap name={card.name} rels={rels} />
          {rels.map((r, i) => (
            <div className="relcard" key={i}>
              <div className="row">
                <select value={r.target} onChange={(e) => patch({ relationships: rels.map((x, j) => (j === i ? { ...x, target: e.target.value } : x)) })}>
                  {cards.filter((c) => c.path !== card.path).map((c) => <option key={c.path} value={c.name}>{c.name}</option>)}
                </select>
                <BlurInput value={r.kind} placeholder="tipo (familia, rival…)" onCommit={(v) => patch({ relationships: rels.map((x, j) => (j === i ? { ...x, kind: v } : x)) })} />
                <button className="mini ghost" onClick={() => patch({ relationships: rels.filter((_, j) => j !== i) })}>×</button>
              </div>
              <BlurInput textarea rows={2} value={r.note} placeholder="Nota" onCommit={(v) => patch({ relationships: rels.map((x, j) => (j === i ? { ...x, note: v } : x)) })} />
            </div>
          ))}
          <button className="ghost" disabled={cards.length < 2} onClick={() => patch({ relationships: [...rels, { target: cards.find((c) => c.path !== card.path)?.name ?? '', kind: '', note: '' }] })}>+ Añadir relación</button>
        </aside>
      )}
    </main>
  )
}

function RelMap({ name, rels }: { name: string; rels: Rel[] }) {
  const W = 300, H = 220, cx = W / 2, cy = H / 2, R = 80
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="graph">
      {rels.map((r, i) => {
        const a = (i / Math.max(1, rels.length)) * Math.PI * 2 - Math.PI / 2
        const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R
        return (
          <g key={i}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke="#e8437f88" />
            <circle cx={x} cy={y} r={16} fill="var(--line)" />
            <text x={x} y={y + 3} textAnchor="middle" fontSize="8" fill="var(--fg)">{r.target.slice(0, 8)}</text>
            <text x={(cx + x) / 2} y={(cy + y) / 2 - 3} textAnchor="middle" fontSize="7" fill="var(--dim)">{r.kind}</text>
          </g>
        )
      })}
      <circle cx={cx} cy={cy} r={22} fill="var(--accent)" />
      <text x={cx} y={cy + 3} textAnchor="middle" fontSize="9" fill="#fff" fontWeight="bold">{name.slice(0, 9)}</text>
    </svg>
  )
}
