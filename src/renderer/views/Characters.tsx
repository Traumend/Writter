import { useEffect, useMemo, useState } from 'react'
import { breakdown } from '../../core/breakdown'
import { readFrontmatter, writeFrontmatter } from '../../core/frontmatter'
import { extractLinks, parseFountain } from '../../core/parser/fountain'
import { MOT_DIMS, readMotivation } from '../../core/planning'
import { project } from '../../core/projection'
import { joinSections, splitSections, type Section } from '../../core/sections'
import { t } from '../i18n'
import { useStore } from '../store'
import { AiSuggest, BlurInput, Field, Icon, useAsset } from '../ui'

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
  ['identity', 'Identidad', ['Cis', 'Trans', 'No binario', 'Otro']],
  ['age', 'Edad', ['Niño', 'Adolescente', 'Joven adulto', 'Adulto', 'Mayor (65+)']]
]
const PROFILE: [string, string, string[]][] = [
  ['dramatic_function', 'Función dramática', ['Motor de conflicto', 'Corazón', 'Mentor', 'Trickster', 'Contraste (foil)', 'Amenaza', 'Alivio cómico', 'Catalizador']],
  ['energy', 'Energía / tono', ['Caótico', 'Calmo', 'Intenso', 'Cálido', 'Frío', 'Volátil']],
  ['voice', 'Perfil de voz', ['Sarcástico', 'Formal', 'Poético', 'Directo', 'Nervioso', 'Autoritario', 'Juguetón']]
]
const APPEARANCE_STATES = ['Cuidada', 'Descuidada', 'Elegante', 'Casual', 'Uniformada', 'Icónica']
const COLORS = ['#ff5a1f', '#e8437f', '#3ddc97', '#4f8cff', '#f5c542', '#b388ff', '#59c1d6', '#c47d1a']
const GUIDE_QUESTIONS = ['¿Qué quiere y por qué?', '¿Cuál es su mayor miedo?', '¿Qué secreto oculta?', '¿Cómo cambia al final?', '¿Qué contradicción lo define?', '¿Cómo habla: voz y muletillas?', '¿Qué relación marca su vida?']
const REL_COLORS: [RegExp, string][] = [
  [/famil|sangre|padre|madre|herman|hij|nieto/i, '#c47d1a'],
  [/amor|roman|atrac|pareja|esposo|esposa/i, '#ff8fb1'],
  [/rival|conflic|enemig|odio/i, '#ff7a6b'],
  [/alia|amig|socio/i, '#3ddc97'],
  [/secre|sospech|oculto/i, '#b388ff'],
  [/plot|narrat|trama/i, '#59c1d6']
]
const kindColor = (k: string) => REL_COLORS.find(([re]) => re.test(k))?.[1] ?? 'var(--dim)'
const SORTS: [string, string][] = [['scenes', 'Más escenas'], ['az', 'A-Z'], ['appear', 'Orden de aparición']]

type Rel = { target: string; kind: string; note: string }

export function Characters() {
  const { files, docs, writeOther, openFile, setTab, vault, saveConfig, path: openPath } = useStore()
  const [sortBy, setSortBy] = useState('scenes')
  const cards = useMemo(() => {
    const list = breakdown(files, docs).filter((c) => c.kind === 'character')
    if (sortBy === 'az') return [...list].sort((a, b) => a.name.localeCompare(b.name))
    if (sortBy === 'appear') return [...list].sort((a, b) => (a.appearances[0]?.scene ?? 1e9) - (b.appearances[0]?.scene ?? 1e9))
    return [...list].sort((a, b) => b.appearances.length - a.appearances.length)
  }, [files, docs, sortBy])
  const [sel, setSel] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [alias, setAlias] = useState('')
  const [newSlider, setNewSlider] = useState('')
  const [showGuide, setShowGuide] = useState(false)
  const [mapBig, setMapBig] = useState(false)
  // Si el archivo abierto en el store es una ficha (botón "Ficha", "Nuevo personaje…"), se selecciona aquí.
  useEffect(() => { if (openPath && cards.some((c) => c.path === openPath)) setSel(openPath) }, [openPath, cards])
  const path = sel ?? cards[0]?.path ?? null
  const card = cards.find((c) => c.path === path)
  const doc = docs.find((d) => d.path === path)
  const color = String((doc ? readFrontmatter(doc.content).data['color'] : '') || '') || '#4f8cff'
  const img = useAsset(card?.image ?? '')
  const { data, body } = doc ? readFrontmatter(doc.content) : { data: {}, body: '' }
  const traits = (data['traits'] as Record<string, number> | undefined) ?? {}
  const mot = readMotivation(data)
  const setMot = (k: string, v: { text?: string; level?: number }) => patch({ motivation: { ...mot, [k]: { text: mot[k as keyof typeof mot]?.text ?? '', level: mot[k as keyof typeof mot]?.level ?? 5, ...v } } })
  const rels = (Array.isArray(data['relationships']) ? data['relationships'] : []) as Rel[]
  const customSliders = vault?.config.characterSliders ?? []
  const { intro, sections } = useMemo(() => splitSections(body), [body])

  const auto = useMemo(() => {
    if (!doc || !card) return []
    const selfNames = new Set([card.name.toLowerCase(), ...card.aliases.map((a) => a.toLowerCase())])
    const formal = new Set(rels.map((r) => r.target.toLowerCase()))
    const seen = new Set<string>()
    const out: string[] = []
    for (const l of extractLinks(doc.content)) {
      const hit = cards.find((c) => c.name.toLowerCase() === l.toLowerCase() || c.aliases.some((a) => a.toLowerCase() === l.toLowerCase()))
      const nm = hit?.name
      if (!nm) continue
      const key = nm.toLowerCase()
      if (selfNames.has(key) || formal.has(key) || seen.has(key)) continue
      seen.add(key)
      out.push(nm)
    }
    return out
  }, [doc, card, cards, rels])

  const str = (k: string) => String(data[k] ?? '')
  const patch = (p: Record<string, unknown>) => doc && void writeOther(doc.path, writeFrontmatter(doc.content, p))
  const headLen = doc ? doc.content.length - body.length : 0
  const writeBody = (b: string) => doc && void writeOther(doc.path, doc.content.slice(0, headLen) + '\n' + b.replace(/^\n+/, ''))
  const setIntro = (t: string) => writeBody(joinSections(t, sections))
  const setSections = (next: Section[]) => writeBody(joinSections(intro, next))
  const openChar = (n: string) => { const f = cards.find((x) => x.name.toLowerCase() === n.toLowerCase()); if (f) { setSel(f.path); void openFile(f.path) } }

  const context = useMemo(() => {
    if (!card) return ''
    const out: string[] = [`Personaje: ${card.name}. Alias: ${card.aliases.join(', ') || '—'}.`]
    let budget = 6000
    for (const a of card.appearances) {
      const d = docs.find((x) => x.path === a.script)
      if (!d) continue
      const doc = parseFountain(d.content)
      const sc = project(doc).scenes[a.scene] // misma proyección que el breakdown (vale también para prosa con secciones)
      if (!sc || sc.heading.toUpperCase() !== a.heading.toUpperCase()) continue
      let speaking = false
      const lines: string[] = [a.heading]
      for (const t of doc.tokens.slice(sc.startLine + 1, sc.endLine)) {
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

  const addSlider = () => {
    const label = newSlider.trim()
    if (!label || !vault) return
    const id = 'x_' + label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
    if (customSliders.some((s) => s.id === id)) return
    void saveConfig({ ...vault.config, characterSliders: [...customSliders, { id, label, lo: 'Bajo', hi: 'Alto', color: COLORS[customSliders.length % COLORS.length]! }] })
    setNewSlider('')
  }
  const delSlider = (id: string) => vault && void saveConfig({ ...vault.config, characterSliders: customSliders.filter((s) => s.id !== id) })

  return (
    <main className="split">
      <aside>
        <h2>{t('Personajes')}</h2>
        <input placeholder={t('Buscar…')} value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ width: '100%', marginBottom: 8 }}>
          {SORTS.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
        </select>
        <ul>
          {cards.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase())).map((c) => {
            const cc = String((docs.find((d) => d.path === c.path) ? readFrontmatter(docs.find((d) => d.path === c.path)!.content).data['color'] : '') || '')
            return (
              <li key={c.path} className={c.path === path ? 'active' : ''} onClick={() => setSel(c.path)}>
                <span className="cdot" style={{ background: cc || 'var(--line)' }} />
                <span className="grow ell">{c.name}</span> <span className="muted tiny">{c.appearances.length} {t('esc.')}</span>
              </li>
            )
          })}
        </ul>
      </aside>
      {card && doc ? (
        <section className="scroll">
          <div className="hero">
            <div className="avatar big" style={{ border: `3px solid ${color}` }} onClick={() => void window.api.assetPick().then((rel) => rel && patch({ image: rel }))}>{img ? <img src={img} alt="" /> : <span>{card.name.slice(0, 1)}</span>}</div>
            <div className="grow">
              <h1>{card.name}</h1>
              <div className="chips" style={{ marginBottom: 6 }}>
                {card.aliases.map((a) => (
                  <span key={a} className="chip alias">{a}<button className="x" title={t('Quitar alias')} onClick={() => patch({ aliases: card.aliases.filter((x) => x !== a) })}><Icon name="close" size={11} /></button></span>
                ))}
                <input className="aliasin" placeholder="+ alias" value={alias} onChange={(e) => setAlias(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && alias.trim()) { patch({ aliases: [...card.aliases, alias.trim()] }); setAlias('') } }} />
              </div>
              <Field label={t('Logline (conectado con la descripción del Breakdown)')}><BlurInput textarea rows={2} value={str('description')} onCommit={(v) => patch({ description: v })} /></Field>
              <AiSuggest instruction="Escribe un logline de una o dos frases para este personaje, en español." context={context} onAccept={(v) => patch({ description: v })} />
              <div className="row" style={{ marginTop: 4 }}>
                <span className="tiny muted">{t('Actor/actriz:')}</span>
                <BlurInput value={str('actor')} placeholder={t('No asignado')} onCommit={(v) => patch({ actor: v })} />
              </div>
              <div className="row" style={{ marginTop: 6 }}>
                <span className="tiny muted">{t('Color:')}</span>
                {COLORS.map((cc) => <span key={cc} className={`swatch ${color === cc ? 'on' : ''}`} style={{ background: cc, width: 20, height: 20 }} onClick={() => patch({ color: cc })} />)}
              </div>
            </div>
            <div className="col">
              <button className="mini ghost" onClick={() => useStore.getState().openRename(card.path, card.name, [card.name, ...card.aliases])}>{t('Renombrar…')}</button>
              <button className="mini ghost" onClick={() => { void openFile(card.path); setTab('desk') }}>{t('Abrir .md')}</button>
            </div>
          </div>

          <h2>{t('Información básica')}</h2>
          <div className="grid6">
            {SEL.map(([k, l, opts]) => (
              <Field key={k} label={t(l)}>
                <select value={str(k)} onChange={(e) => patch({ [k]: e.target.value })}>
                  <option value="">—</option>
                  {opts.map((o) => <option key={o} value={o}>{t(o)}</option>)}
                </select>
              </Field>
            ))}
            <Field label={t('Nacimiento (fecha / lugar)')}><BlurInput value={str('birth')} onCommit={(v) => patch({ birth: v })} /></Field>
            <Field label={t('Ocupación')}><BlurInput value={str('occupation')} onCommit={(v) => patch({ occupation: v })} /></Field>
            <Field label={t('Origen / cultura')}><BlurInput value={str('origin')} onCommit={(v) => patch({ origin: v })} /></Field>
          </div>

          <h2>{t('Apariencia')}</h2>
          <div className="row" style={{ marginBottom: 8 }}>
            <span className="tiny muted">{t('Estado:')}</span>
            <select value={str('appearance_state')} onChange={(e) => patch({ appearance_state: e.target.value })}>
              <option value="">—</option>
              {APPEARANCE_STATES.map((o) => <option key={o} value={o}>{t(o)}</option>)}
            </select>
          </div>
          <div><BlurInput textarea rows={4} value={str('appearance')} placeholder={t('Casting, vestuario, marcas visibles…')} onCommit={(v) => patch({ appearance: v })} /></div>
          <AiSuggest instruction="Describe la apariencia física y el vestuario de este personaje en un párrafo, solo con lo que el guión soporte." context={context} onAccept={(v) => patch({ appearance: v })} />

          <h2>{t('Biografía')} · {intro.trim().split(/\s+/).filter(Boolean).length} {t('palabras')}</h2>
          <div><BlurInput textarea rows={10} value={intro} placeholder={t('Biografía en prosa (cuerpo del .md)')} onCommit={setIntro} /></div>
          <AiSuggest instruction="Escribe una biografía breve (100-150 palabras) de este personaje basada en las escenas." context={context} onAccept={(v) => setIntro(v)} />

          <h2>Want / Need</h2>
          <div className="grid2">
            <Field label={t('Quiere (externo)')}><BlurInput textarea rows={2} value={str('want')} onCommit={(v) => patch({ want: v })} /></Field>
            <Field label={t('Necesita (interno)')}><BlurInput textarea rows={2} value={str('need')} onCommit={(v) => patch({ need: v })} /></Field>
          </div>
          <AiSuggest instruction='Responde en dos líneas: "Quiere: …" (deseo externo) y "Necesita: …" (necesidad interna).' context={context} onAccept={(v) => {
            const w = /Quiere:\s*(.*)/i.exec(v)?.[1] ?? ''
            const n = /Necesita:\s*(.*)/i.exec(v)?.[1] ?? ''
            patch({ want: w.trim(), need: n.trim() })
          }} />

          <h2>{t('Motor de personaje')} <span className="muted tiny">{MOT_DIMS.filter(([k]) => mot[k]?.text.trim()).length}/10</span></h2>
          <p className="muted tiny">{t('Diez dimensiones motivacionales. Se cruzan en la Matriz de motivación (Planificación → Ideas) para generar premisas de escena.')}</p>
          <div className="grid2 engine">
            {MOT_DIMS.map(([k, l, hint]) => (
              <div className="engine-row" key={k}>
                <div className="row tiny"><b>{t(l)}</b><span className="grow" /><span className="muted">{mot[k]?.level ?? 5}</span></div>
                <BlurInput value={mot[k]?.text ?? ''} placeholder={t(hint)} onCommit={(v) => setMot(k, { text: v })} />
                <input type="range" min={0} max={10} value={mot[k]?.level ?? 5} onChange={(e) => setMot(k, { level: Number(e.target.value) })} />
              </div>
            ))}
          </div>

          <h2>{t('Profundización')}
            <button className="mini ghost" onClick={() => setSections([...sections, { title: t('Nueva sección'), body: '' }])}><Icon name="plus" size={12} />{t('Añadir sección')}</button>
            <button className="mini ghost" onClick={() => setShowGuide((s) => !s)}><Icon name="question" size={12} />{t('Preguntas guía')}</button>
          </h2>
          {showGuide && (
            <div className="panelbox" style={{ marginBottom: 10 }}>
              <p className="muted tiny">{t('Añade una pregunta como sección para responderla:')}</p>
              <div className="chips">{GUIDE_QUESTIONS.map((qq) => <button key={qq} className="mini ghost" onClick={() => { setSections([...sections, { title: t(qq), body: '' }]); setShowGuide(false) }}>{t(qq)}</button>)}</div>
            </div>
          )}
          {sections.map((s, i) => (
            <div className="section-card" key={i}>
              <div className="row">
                <BlurInput value={s.title} onCommit={(v) => setSections(sections.map((x, j) => (j === i ? { ...x, title: v } : x)))} />
                <button className="del" title={t('Eliminar sección')} onClick={() => setSections(sections.filter((_, j) => j !== i))}><Icon name="trash" size={14} /></button>
              </div>
              <BlurInput textarea rows={4} value={s.body} placeholder={t('Contenido…')} onCommit={(v) => setSections(sections.map((x, j) => (j === i ? { ...x, body: v } : x)))} />
            </div>
          ))}
        </section>
      ) : <section><p className="muted center">{t('Sin personajes. Créalos en Breakdown.')}</p></section>}
      {card && doc && (
        <aside className="right scroll">
          <h2>{t('Perfil creativo')}</h2>
          {PROFILE.map(([k, l, opts]) => (
            <Field key={k} label={t(l)}>
              <select value={str(k)} onChange={(e) => patch({ [k]: e.target.value })} style={{ width: '100%' }}>
                <option value="">—</option>
                {opts.map((o) => <option key={o} value={o}>{t(o)}</option>)}
              </select>
            </Field>
          ))}

          <h2>{t('Sliders')}</h2>
          {TRAITS.map(([k, l, lo, hi, c]) => (
            <div className="slider" key={k}>
              <div className="row"><span>{t(l)}</span><span className="grow" /><strong style={{ color: c }}>{traits[k] ?? 50}</strong></div>
              <input type="range" min={0} max={100} value={traits[k] ?? 50} style={{ accentColor: c }} onChange={(e) => patch({ traits: { ...traits, [k]: Number(e.target.value) } })} />
              <div className="row tiny muted"><span>{t(lo)}</span><span className="grow" /><span>{t(hi)}</span></div>
            </div>
          ))}
          {customSliders.map((cs) => (
            <div className="slider" key={cs.id}>
              <div className="row"><span>{cs.label}</span><span className="grow" /><strong style={{ color: cs.color }}>{traits[cs.id] ?? 50}</strong><button className="del" title={t('Quitar métrica del proyecto')} onClick={() => delSlider(cs.id)}><Icon name="close" size={12} /></button></div>
              <input type="range" min={0} max={100} value={traits[cs.id] ?? 50} style={{ accentColor: cs.color }} onChange={(e) => patch({ traits: { ...traits, [cs.id]: Number(e.target.value) } })} />
              <div className="row tiny muted"><span>{cs.lo}</span><span className="grow" /><span>{cs.hi}</span></div>
            </div>
          ))}
          <div className="row">
            <input placeholder={t('Nueva métrica del proyecto…')} value={newSlider} onChange={(e) => setNewSlider(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSlider()} />
            <button className="mini" title={t('Añadir métrica')} onClick={addSlider}><Icon name="plus" size={12} /></button>
          </div>

          <h2>{t('Relaciones')} · {rels.length + auto.length}
            <button className="mini ghost" title={t('Ampliar mapa')} onClick={() => setMapBig(true)}><Icon name="expand" size={12} /></button>
          </h2>
          <RelMap name={card.name} color={color} rels={rels} auto={auto} onOpen={openChar} />
          {rels.map((r, i) => (
            <div className="relcard" key={i}>
              <div className="row">
                <select className="grow" value={r.target} onChange={(e) => patch({ relationships: rels.map((x, j) => (j === i ? { ...x, target: e.target.value } : x)) })}>
                  {cards.filter((c) => c.path !== card.path).map((c) => <option key={c.path} value={c.name}>{c.name}</option>)}
                </select>
                <button className="del" title={t('Eliminar relación')} onClick={() => patch({ relationships: rels.filter((_, j) => j !== i) })}><Icon name="close" size={14} /></button>
              </div>
              {r.kind && <span className="chip" style={{ color: kindColor(r.kind), borderColor: kindColor(r.kind) }}>{r.kind}</span>}
              <BlurInput value={r.kind} placeholder={t('tipo (familia, rival…)')} onCommit={(v) => patch({ relationships: rels.map((x, j) => (j === i ? { ...x, kind: v } : x)) })} />
              <BlurInput textarea rows={2} value={r.note} placeholder={t('Nota')} onCommit={(v) => patch({ relationships: rels.map((x, j) => (j === i ? { ...x, note: v } : x)) })} />
            </div>
          ))}
          <button className="ghost" disabled={cards.length < 2} onClick={() => patch({ relationships: [...rels, { target: cards.find((c) => c.path !== card.path)?.name ?? '', kind: '', note: '' }] })}><Icon name="plus" size={12} />{t('Añadir relación')}</button>

          {auto.length > 0 && (
            <>
              <h2>{t('Detectadas en el texto')} · {auto.length}</h2>
              <p className="muted tiny">{t('Enlaces [[ ]] en la ficha. Formalízalas para darles tipo y nota, o edítalas quitando el enlace del texto.')}</p>
              {auto.map((n) => (
                <div className="relcard auto" key={n}>
                  <span className="link grow ell" onClick={() => openChar(n)}>[[{n}]]</span>
                  <button className="mini" title={t('Añadir como relación')} onClick={() => patch({ relationships: [...rels, { target: n, kind: '', note: '' }] })}><Icon name="plus" size={12} />{t('relación')}</button>
                </div>
              ))}
            </>
          )}
        </aside>
      )}
      {mapBig && card && (
        <div className="modal-backdrop" onClick={() => setMapBig(false)}>
          <div className="modal" style={{ width: 'min(760px,94vw)' }} onClick={(e) => e.stopPropagation()}>
            <div className="row"><h1>{t('Mapa de relaciones')} · {card.name}</h1><span className="grow" /><button className="mini ghost" onClick={() => setMapBig(false)}>{t('Cerrar')}</button></div>
            <RelMap name={card.name} color={color} rels={rels} auto={auto} onOpen={(n) => { setMapBig(false); openChar(n) }} big />
          </div>
        </div>
      )}
    </main>
  )
}

function RelMap({ name, color, rels, auto, onOpen, big }: { name: string; color: string; rels: Rel[]; auto: string[]; onOpen: (n: string) => void; big?: boolean }) {
  const W = big ? 700 : 300, H = big ? 460 : 220, cx = W / 2, cy = H / 2, R = big ? 180 : 82
  const nodes = [...rels.map((r) => ({ target: r.target, kind: r.kind, auto: false })), ...auto.map((t) => ({ target: t, kind: '', auto: true }))]
  const rNode = big ? 24 : 15
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="graph">
      {nodes.map((r, i) => {
        const a = (i / Math.max(1, nodes.length)) * Math.PI * 2 - Math.PI / 2
        const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R
        const col = r.auto ? '#9aa1ad88' : (REL_COLORS.find(([re]) => re.test(r.kind))?.[1] ?? '#e8437f')
        return (
          <g key={i} style={{ cursor: 'pointer' }} onClick={() => onOpen(r.target)}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke={col} strokeDasharray={r.auto ? '3 3' : undefined} />
            <circle cx={x} cy={y} r={rNode} fill="var(--line)" stroke={col} strokeWidth={r.auto ? 1 : 2} />
            <text x={x} y={y + 3} textAnchor="middle" fontSize={big ? 11 : 8} fill="var(--fg)">{r.target.slice(0, big ? 12 : 8)}</text>
            {r.kind && <text x={(cx + x) / 2} y={(cy + y) / 2 - 3} textAnchor="middle" fontSize={big ? 9 : 7} fill="var(--dim)">{r.kind}</text>}
          </g>
        )
      })}
      <circle cx={cx} cy={cy} r={big ? 34 : 22} fill={color} />
      <text x={cx} y={cy + 3} textAnchor="middle" fontSize={big ? 12 : 9} fill="#fff" fontWeight="bold">{name.slice(0, big ? 12 : 9)}</text>
    </svg>
  )
}
