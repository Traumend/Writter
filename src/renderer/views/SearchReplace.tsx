import { useState } from 'react'
import { searchReplace, type SRResult } from '../../core/searchreplace'
import type { TokenType } from '../../core/parser/fountain'
import { useStore } from '../store'

// Buscar y reemplazar global sobre los guiones del vault (Nivel 1).
const BLOCKS: [TokenType, string][] = [
  ['heading', 'Encabezado'], ['action', 'Acción'], ['character', 'Personaje'],
  ['dialogue', 'Diálogo'], ['parenthetical', 'Acotación'], ['transition', 'Transición'], ['note', 'Nota']
]

export function SearchReplace() {
  const { searchOpen, closeSearch, files, docs, path, refreshDocs, reloadFromDisk } = useStore()
  const [q, setQ] = useState('')
  const [repl, setRepl] = useState('')
  const [caseSensitive, setCase] = useState(false)
  const [wholeWord, setWhole] = useState(false)
  const [regex, setRegex] = useState(false)
  const [blocks, setBlocks] = useState<Set<TokenType>>(new Set())
  const [scopeAll, setScopeAll] = useState(true)
  const [results, setResults] = useState<SRResult[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  if (!searchOpen) return null

  const scriptPaths = new Set(files.filter((f) => f.kind === 'script' && (scopeAll || f.path === path)).map((f) => f.path))
  const opts = () => ({ query: q, replace: repl, caseSensitive, wholeWord, regex, blockTypes: blocks.size ? [...blocks] : null })
  const preview = () => {
    setErr('')
    try {
      setResults(searchReplace(docs, scriptPaths, opts()))
    } catch (e) {
      setErr(`Regex inválida: ${String(e).replace(/^Error:\s*/, '')}`)
      setResults(null)
    }
  }
  const apply = async () => {
    if (!results?.length) return
    setBusy(true)
    try {
      for (const r of results) await window.api.fileWrite(r.path, r.content, undefined, 'user')
      await refreshDocs()
      if (results.some((r) => r.path === path)) await reloadFromDisk()
      setResults(null)
      setQ('')
      closeSearch()
    } finally {
      setBusy(false)
    }
  }
  const total = results?.reduce((a, r) => a + r.count, 0) ?? 0

  return (
    <div className="modal-backdrop" onClick={closeSearch}>
      <div className="modal search" onClick={(e) => e.stopPropagation()}>
        <div className="row"><h1>Buscar y reemplazar</h1><span className="grow" /><button className="ghost mini" onClick={closeSearch}>Cerrar</button></div>
        <div className="grid2">
          <label className="field"><span>Buscar</span><input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setResults(null) }} onKeyDown={(e) => e.key === 'Enter' && preview()} /></label>
          <label className="field"><span>Reemplazar por (vacío = eliminar)</span><input value={repl} onChange={(e) => setRepl(e.target.value)} /></label>
        </div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 14 }}>
          <label className="check"><input type="checkbox" checked={caseSensitive} onChange={(e) => setCase(e.target.checked)} /> Distinguir mayúsculas</label>
          <label className="check"><input type="checkbox" checked={wholeWord} onChange={(e) => setWhole(e.target.checked)} /> Palabra completa</label>
          <label className="check"><input type="checkbox" checked={regex} onChange={(e) => setRegex(e.target.checked)} /> Regex</label>
          <span className="grow" />
          <label className="check"><input type="checkbox" checked={scopeAll} onChange={(e) => { setScopeAll(e.target.checked); setResults(null) }} /> Todos los guiones</label>
        </div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
          <span className="muted tiny">Bloques:</span>
          {BLOCKS.map(([t, l]) => (
            <button key={t} className={blocks.has(t) ? 'on mini' : 'ghost mini'} onClick={() => { setBlocks((s) => { const n = new Set(s); n.has(t) ? n.delete(t) : n.add(t); return n }); setResults(null) }}>{l}</button>
          ))}
          <span className="muted tiny">{blocks.size ? '' : '(todos)'}</span>
        </div>
        {err && <p className="err">{err}</p>}
        {results && (
          <div className="scroll" style={{ maxHeight: '34vh', marginTop: 10 }}>
            {results.length === 0 ? <p className="muted">Sin coincidencias.</p> : (
              <>
                <p className="muted tiny">{total} coincidencia(s) en {results.length} archivo(s).</p>
                {results.map((r) => (
                  <div className="linkrow" key={r.path}>
                    <div className="row"><strong className="tiny">{r.path.split('/').pop()}</strong><span className="grow" /><span className="badge no">{r.count}</span></div>
                    {r.samples.map((s, i) => <div key={i} className="tiny muted ell">{s}</div>)}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
          <button className="ghost" onClick={preview} disabled={!q}>Previsualizar</button>
          <button onClick={() => void apply()} disabled={busy || !results?.length}>Aplicar {total ? `(${total})` : ''}</button>
        </div>
      </div>
    </div>
  )
}
