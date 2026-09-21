import { useMemo, useState } from 'react'
import { premises } from '../../../core/cmm'
import { readFrontmatter } from '../../../core/frontmatter'
import { MOT_DIMS, readMotivation, uid, type Idea } from '../../../core/planning'
import { getLang, t } from '../../i18n'
import { useStore } from '../../store'
import { Icon, BlurInput } from '../../ui'
import { useCards, usePlanning, useScripts } from './data'
import { CharChips } from './shared'

// Ideas de escena (huérfanas) + Matriz de motivación (CMM): premisas por reglas a partir de dos personajes.
export function Ideas() {
  const scripts = useScripts()
  const cards = useCards()
  const { planning, save } = usePlanning()
  const { docs, openFile, setTab, setDevTab } = useStore()
  const [title, setTitle] = useState('')
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const chars = cards.filter((c) => c.kind === 'character')
  const names = chars.map((c) => c.name)
  const actor = (name: string) => { const c = chars.find((x) => x.name === name); const d = c && docs.find((x) => x.path === c.path); return c ? { name: c.name, motivation: readMotivation(d ? readFrontmatter(d.content).data : {}) } : null }
  const A = actor(a), B = actor(b)
  const list = useMemo(() => (A && B && A.name !== B.name ? premises(A, B, getLang()) : []), [A, B])
  const filled = (n: string) => { const m = actor(n)?.motivation ?? {}; return MOT_DIMS.filter(([k]) => m[k]?.text.trim()).length }
  const upd = (id: string, p: Partial<Idea>) => void save({ ideas: planning.ideas.map((x) => (x.id === id ? { ...x, ...p } : x)) })
  const add = (ti: string, summary = '', characters: string[] = []) => void save({ ideas: [...planning.ideas, { id: uid(), title: ti, summary, characters, track: '', created: Date.now() }] })
  // Integrar: añade la escena al final del guion elegido como encabezado + sinopsis en nota, y retira la idea.
  const integrate = async (idea: Idea, scriptPath: string) => {
    const d = docs.find((x) => x.path === scriptPath)
    if (!d) return
    const heading = idea.title.toUpperCase().startsWith('INT') || idea.title.toUpperCase().startsWith('EXT') ? idea.title : `INT. ${idea.title.toUpperCase()} - DÍA`
    const block = `\n\n${heading}\n\n${idea.summary ? `%% ${idea.summary} %%\n\n` : ''}`
    await useStore.getState().writeOther(scriptPath, d.content.replace(/\n+$/, '') + block)
    await save({ ideas: planning.ideas.filter((x) => x.id !== idea.id) })
    void openFile(scriptPath); setTab('desk')
  }

  return (
    <main className="page scroll">
      <div className="grid2">
        <div>
          <div className="toolbar wrap">
            <input placeholder={t('Nueva idea de escena · Enter')} value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && title.trim()) { add(title.trim()); setTitle('') } }} style={{ width: 320 }} />
            <span className="muted tiny">{planning.ideas.length} {t('ideas sin integrar')}</span>
          </div>
          {planning.ideas.length === 0 && <p className="muted">{t('Bandeja vacía. Captura ideas sin forzar un orden; intégralas al guion cuando encajen.')}</p>}
          {planning.ideas.map((idea) => (
            <div className="panelbox" key={idea.id}>
              <div className="row"><BlurInput value={idea.title} onCommit={(v) => upd(idea.id, { title: v })} /><button className="mini ghost" title={t('Quitar')} onClick={() => void save({ ideas: planning.ideas.filter((x) => x.id !== idea.id) })}><Icon name="close" size={12} /></button></div>
              <BlurInput textarea rows={2} value={idea.summary} placeholder={t('Sinopsis / premisa')} onCommit={(v) => upd(idea.id, { summary: v })} />
              <CharChips all={names} value={idea.characters} onChange={(v) => upd(idea.id, { characters: v })} />
              <div className="row tiny">
                <select value={idea.track} onChange={(e) => upd(idea.id, { track: e.target.value })}><option value="">{t('— track —')}</option>{planning.tracks.map((tr) => <option key={tr.id} value={tr.id}>{tr.name}</option>)}</select>
                <span className="grow" />
                {scripts.length > 0 && <select defaultValue="" onChange={(e) => { if (e.target.value) void integrate(idea, e.target.value); e.target.value = '' }}><option value="">{t('Integrar al guion…')}</option>{scripts.map((s) => <option key={s.path} value={s.path}>{s.name}</option>)}</select>}
              </div>
            </div>
          ))}
        </div>

        <div className="panelbox">
          <h2>{t('Matriz de motivación')}</h2>
          <p className="muted tiny">{t('Cruza las 10 dimensiones de dos personajes y genera premisas de escena por reglas (sin IA). Rellena el Motor de personaje en la ficha.')}</p>
          <div className="row">
            <select value={a} onChange={(e) => setA(e.target.value)}><option value="">{t('Personaje A')}</option>{names.map((n) => <option key={n} value={n}>{n} ({filled(n)}/10)</option>)}</select>
            <select value={b} onChange={(e) => setB(e.target.value)}><option value="">{t('Personaje B')}</option>{names.map((n) => <option key={n} value={n}>{n} ({filled(n)}/10)</option>)}</select>
          </div>
          {A && B && list.length === 0 && <p className="muted tiny">{t('Sin premisas: ambos personajes necesitan dimensiones con texto.')} <button className="mini ghost" onClick={() => { const c = chars.find((x) => x.name === a); if (c) { void openFile(c.path); setTab('dev'); setDevTab('characters') } }}>{t('Abrir ficha')}</button></p>}
          {list.map((p, i) => (
            <div className="premise" key={i}>
              <div className="row tiny muted"><span>{t(MOT_DIMS.find(([k]) => k === p.dims[0])?.[1] ?? '')} × {t(MOT_DIMS.find(([k]) => k === p.dims[1])?.[1] ?? '')}</span><span className="grow" /><b>{p.score}</b></div>
              <p>{p.text}</p>
              <button className="mini ghost" onClick={() => add(`${A!.name} / ${B!.name}`, p.text, [A!.name, B!.name])}><Icon name="plus" size={12} />{t('Añadir como idea de escena')}</button>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
