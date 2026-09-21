import { useMemo, useState } from 'react'
import { CATEGORIES, LIBRARY, byId, type LibEntry, type LibKind } from '../../../core/library'
import { t } from '../../i18n'
import { useStore } from '../../store'

const KIND_LABEL: Record<LibKind, string> = { technique: 'Técnicas', psychology: 'Psicología', trope: 'Tropos' }
const FAV_KEY = 'writter.libfav'
const loadFav = (): string[] => { try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]') as string[] } catch { return [] } }

// Biblioteca editorial (contenido original): técnicas, psicología y tropos con relacionados (constelación de proximidad).
export function Library() {
  const { createFile, roleDir } = useStore()
  const [kind, setKind] = useState<LibKind>('technique')
  const [cat, setCat] = useState('')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<LibEntry | null>(null)
  const [fav, setFav] = useState<string[]>(loadFav)
  const [onlyFav, setOnlyFav] = useState(false)
  const toggleFav = (id: string) => { const n = fav.includes(id) ? fav.filter((x) => x !== id) : [...fav, id]; setFav(n); localStorage.setItem(FAV_KEY, JSON.stringify(n)) }
  const list = useMemo(() => { const ql = q.toLowerCase(); return LIBRARY.filter((e) => e.kind === kind && (!cat || e.category === cat) && (!onlyFav || fav.includes(e.id)) && (!ql || [e.title, e.summary, e.when, e.tags.join(' ')].join(' ').toLowerCase().includes(ql))) }, [kind, cat, q, onlyFav, fav])
  // "Crear nota": lleva la técnica al vault como nota de conocimiento para aplicarla al proyecto.
  const toNote = (e: LibEntry) => void createFile(`${roleDir('knowledge')}/${e.title}.md`, `---\ntype: knowledge\ntitle: "${e.title}"\nsource: library/${e.id}\n---\n\n${e.summary}\n\n**${t('Cuándo')}:** ${e.when}\n\n**${t('Cuidado')}:** ${e.pitfalls}\n`, true)

  return (
    <main className="split bd">
      <aside>
        <h2>{t('Biblioteca')}</h2>
        <ul>
          {(Object.keys(KIND_LABEL) as LibKind[]).map((k) => <li key={k} className={kind === k ? 'active' : ''} onClick={() => { setKind(k); setCat(''); setSel(null) }}><span className="grow">{t(KIND_LABEL[k])}</span><span className="muted tiny">{LIBRARY.filter((e) => e.kind === k).length}</span></li>)}
        </ul>
        <h2>{t('Categorías')}</h2>
        <ul>
          <li className={cat === '' ? 'active' : ''} onClick={() => setCat('')}>{t('Todas')}</li>
          {CATEGORIES(kind).map((c) => <li key={c} className={cat === c ? 'active' : ''} onClick={() => setCat(c)}>{c}</li>)}
        </ul>
        <label className="check tiny"><input type="checkbox" checked={onlyFav} onChange={(e) => setOnlyFav(e.target.checked)} /> {t('Solo favoritos')} ({fav.length})</label>
        <p className="muted tiny" style={{ marginTop: 10 }}>{t('Contenido original de Writter, separado de tus datos. Crece con cada versión.')}</p>
      </aside>
      <section className="scroll">
        <div className="toolbar"><input placeholder={t('Buscar en la biblioteca…')} value={q} onChange={(e) => setQ(e.target.value)} /><span className="muted tiny">{list.length}</span></div>
        <div className="grid2">
          <div className="cards libcards">
            {list.map((e) => (
              <div key={e.id} className={`card ${sel?.id === e.id ? 'on' : ''}`} onClick={() => setSel(e)}>
                <div className="row"><strong className="grow" style={{ textTransform: 'none', fontSize: 14 }}>{e.title}</strong><button className={`mini ghost ${fav.includes(e.id) ? 'on' : ''}`} onClick={(ev) => { ev.stopPropagation(); toggleFav(e.id) }}>★</button></div>
                <div className="muted tiny">{e.category}</div>
                <p className="tiny">{e.summary}</p>
              </div>
            ))}
            {list.length === 0 && <p className="muted">{t('Sin resultados.')}</p>}
          </div>
          {sel && (
            <div className="panelbox sticky">
              <h2>{sel.title}</h2>
              <p className="muted tiny">{t(KIND_LABEL[sel.kind])} · {sel.category} · {sel.tags.map((x) => `#${x}`).join(' ')}</p>
              <p>{sel.summary}</p>
              <p><b>{sel.kind === 'psychology' ? t('Se manifiesta') : sel.kind === 'trope' ? t('Uso habitual') : t('Cuándo')}:</b> {sel.when}</p>
              <p><b>{t('Cuidado')}:</b> {sel.pitfalls}</p>
              {sel.related.length > 0 && <><h2>{t('Relacionadas')}</h2><div className="chips">{sel.related.map((id) => byId(id)).filter(Boolean).map((r) => <button key={r!.id} className="chip" onClick={() => { setKind(r!.kind); setCat(''); setSel(r!) }}>{r!.title}</button>)}</div></>}
              <div className="row" style={{ marginTop: 10 }}><button className="ghost" onClick={() => toNote(sel)}>{t('Crear nota en el vault')}</button><button className="ghost mini" onClick={() => void navigator.clipboard.writeText(`${sel.title} — ${sel.summary}`)}>{t('Copiar referencia')}</button></div>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
