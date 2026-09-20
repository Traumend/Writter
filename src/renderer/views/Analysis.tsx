import { useEffect, useMemo, useState } from 'react'
import { doctor } from '../../core/doctor'
import { parseFountain } from '../../core/parser/fountain'
import { project } from '../../core/projection'
import type { Analysis as A } from '../../core/types/ipc'
import { cleanErr, useStore } from '../store'
import { EpisodeSelect, useDoc } from '../ui'

// Paleta categórica validada (dataviz, modo oscuro, superficie #171a21): rosa, ámbar, azul.
const SERIES: [keyof Pick<A['scenes'][number], 'intensity' | 'tension' | 'attention'>, string, string][] = [
  ['intensity', 'Intensidad emocional', '#e8437f'],
  ['tension', 'Tensión dramática', '#c47d1a'],
  ['attention', 'Captura de atención', '#4f8cff']
]
const EMO = ['#8b91a0', '#e8437f', '#c47d1a', '#4f8cff', '#3ddc97', '#b388ff', '#ff8fb1', '#59c1d6', '#d66b59', '#9bd659']
const emoColor = (e: string) => EMO[[...e.toLowerCase()].reduce((a, c) => a + c.charCodeAt(0), 0) % EMO.length]!

function Chart({ a, onPick }: { a: A; onPick: (i: number) => void }) {
  const [hover, setHover] = useState<number | null>(null)
  const [on, setOn] = useState(new Set(SERIES.map((s) => s[0])))
  const W = 1000, H = 260, L = 36, R = 16, T = 16, B = 28
  const n = Math.max(1, a.scenes.length)
  const x = (i: number) => L + (i / Math.max(1, n - 1)) * (W - L - R)
  const y = (v: number) => T + (1 - v / 10) * (H - T - B)
  const path = (k: (typeof SERIES)[number][0]) => a.scenes.map((s, i) => `${i ? 'L' : 'M'}${x(i)},${y(s[k])}`).join(' ')
  const hs = hover !== null ? a.scenes[hover] : null
  return (
    <div className="chart">
      <div className="legend">
        {SERIES.map(([k, l, c]) => (
          <label key={k} className="check"><input type="checkbox" checked={on.has(k)} onChange={() => setOn((s) => { const m = new Set(s); m.has(k) ? m.delete(k) : m.add(k); return m })} /><span className="sw" style={{ background: c }} /> {l}</label>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} onMouseLeave={() => setHover(null)} onMouseMove={(e) => {
        const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
        const px = ((e.clientX - r.left) / r.width) * W
        setHover(Math.max(0, Math.min(n - 1, Math.round(((px - L) / (W - L - R)) * (n - 1)))))
      }}>
        {[0, 2, 4, 6, 8, 10].map((v) => (
          <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--line)" /><text x={L - 6} y={y(v) + 3} textAnchor="end" fontSize="10" fill="var(--dim)">{v}</text></g>
        ))}
        {a.scenes.map((s, i) => <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="var(--dim)">E{s.index + 1}</text>)}
        {SERIES.filter(([k]) => on.has(k)).map(([k, , c]) => (
          <g key={k}>
            <path d={path(k)} fill="none" stroke={c} strokeWidth={2} strokeLinejoin="round" />
            {a.scenes.map((s, i) => <circle key={i} cx={x(i)} cy={y(s[k])} r={hover === i ? 5 : 3} fill={c} stroke="var(--panel)" strokeWidth={2} />)}
          </g>
        ))}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="var(--dim)" strokeDasharray="3 3" />}
        <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="transparent" onClick={() => hover !== null && onPick(hover)} style={{ cursor: 'pointer' }} />
      </svg>
      {hs && (
        <div className="tooltip">
          <strong>E{hs.index + 1}</strong> · {hs.emotion}
          {SERIES.map(([k, l, c]) => <div key={k}><span className="sw" style={{ background: c }} /> {l}: <b>{hs[k]}/10</b></div>)}
          <div className="muted">{hs.summary}</div>
        </div>
      )}
    </div>
  )
}

export function Analysis() {
  const { files, docs } = useStore()
  const scripts = files.filter((f) => f.kind === 'script')
  const [ep, setEp] = useState<string | null>(scripts[0]?.path ?? null)
  const script = ep ?? scripts[0]?.path ?? null
  const doc = useDoc(script)
  const [list, setList] = useState<{ id: string; ts: number }[]>([])
  const [cur, setCur] = useState<A | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [pick, setPick] = useState<number | null>(null)
  const [tab, setTab] = useState<'ai' | 'doctor'>('ai')
  const [docFocus, setDocFocus] = useState('')
  const [docReport, setDocReport] = useState('')
  const [docBusy, setDocBusy] = useState(false)
  const [docErr, setDocErr] = useState('')
  const runDoctorAi = async () => {
    if (!doc) return
    setDocBusy(true)
    setDocErr('')
    try {
      setDocReport((await window.api.aiDoctor(doc.content, docFocus)).text)
    } catch (e) {
      setDocErr(cleanErr(e))
    } finally {
      setDocBusy(false)
    }
  }

  useEffect(() => {
    setCur(null)
    setDocReport('')
    if (!script) return
    void window.api.analysisList(script).then((l) => { setList(l); if (l[0]) void window.api.analysisRead(script, l[0].id).then(setCur) })
  }, [script])

  const run = async () => {
    if (!script || !doc) return
    setBusy(true)
    setErr('')
    try {
      const a = await window.api.aiAnalyze(script, doc.content)
      setCur(a)
      setList(await window.api.analysisList(script))
    } catch (e) {
      setErr(cleanErr(e))
    } finally {
      setBusy(false)
    }
  }

  const known = useMemo(() => new Set(files.filter((f) => f.kind !== 'script').map((f) => f.name.toLowerCase())), [files])
  const dr = useMemo(() => {
    const p = parseFountain(doc?.content ?? '')
    return doctor(p, project(p), known)
  }, [doc?.content, known])
  const maxW = Math.max(1, ...dr.stats.map((s) => s.dialogue + s.action))

  return (
    <main className="page scroll">
      <div className="toolbar">
        <EpisodeSelect value={script} onChange={setEp} />
        <button className={tab === 'ai' ? 'on' : 'ghost'} onClick={() => setTab('ai')}>Análisis IA</button>
        <button className={tab === 'doctor' ? 'on' : 'ghost'} onClick={() => setTab('doctor')}>Script Doctor ({dr.findings.length})</button>
        <span className="grow" />
        {tab === 'ai' && list.length > 0 && (
          <select value={cur?.id ?? ''} onChange={(e) => script && void window.api.analysisRead(script, e.target.value).then(setCur)}>
            {list.map((l) => <option key={l.id} value={l.id}>{new Date(l.ts).toLocaleString()}</option>)}
          </select>
        )}
        {tab === 'ai' && <button disabled={!doc || busy} onClick={() => void run()}>{busy ? 'Analizando…' : 'Analizar con IA'}</button>}
      </div>
      {err && <p className="err">{err}</p>}

      {tab === 'ai' && !cur && <p className="muted center">Sin análisis para este episodio. Pulsa "Analizar con IA" (usa tu clave BYOK; el resultado se guarda en .narrative/analysis).</p>}
      {tab === 'ai' && cur && (
        <>
          <div className="grid2">
            <div className="block panelbox">
              <p><b>Estructura:</b> {cur.structure}</p>
              <p><b>Trama:</b> {cur.plot}</p>
              <p><b>Tema:</b> {cur.theme}</p>
              <p><b>Tono:</b> {cur.tone}</p>
              <p className="muted tiny">{cur.model} · {new Date(cur.ts).toLocaleString()}</p>
            </div>
            <div className="block panelbox">
              <h2>Notas</h2>
              <ul className="bullets">{cur.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
            </div>
          </div>
          <h2>Métricas por escena</h2>
          <Chart a={cur} onPick={setPick} />
          <h2>Paleta de emociones</h2>
          <div className="palette">
            {cur.scenes.map((s) => (
              <div key={s.index} className="emo" style={{ background: emoColor(s.emotion) }} title={`E${s.index + 1}: ${s.emotion}`} onClick={() => setPick(s.index)}><span>E{s.index + 1}</span><b>{s.emotion}</b></div>
            ))}
          </div>
          {pick !== null && cur.scenes[pick] && (
            <div className="block panelbox">
              <h2>E{cur.scenes[pick]!.index + 1} · {cur.scenes[pick]!.emotion}</h2>
              <p>{cur.scenes[pick]!.summary}</p>
              <ul className="bullets">{cur.scenes[pick]!.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
            </div>
          )}
          <details>
            <summary className="muted">Tabla de datos</summary>
            <table className="table">
              <thead><tr><th>Escena</th><th>Emoción</th>{SERIES.map(([k, l]) => <th key={k}>{l}</th>)}<th>Resumen</th></tr></thead>
              <tbody>{cur.scenes.map((s) => <tr key={s.index}><td>E{s.index + 1}</td><td>{s.emotion}</td>{SERIES.map(([k]) => <td key={k}>{s[k]}</td>)}<td>{s.summary}</td></tr>)}</tbody>
            </table>
          </details>
        </>
      )}

      {tab === 'doctor' && (
        <div className="grid2">
          <div className="block panelbox">
            <div className="row"><h2>Diagnóstico con IA</h2><span className="grow" />
              <input style={{ width: 220 }} placeholder="Enfoque (ritmo, diálogo…)" value={docFocus} onChange={(e) => setDocFocus(e.target.value)} />
              <button disabled={!doc || docBusy} onClick={() => void runDoctorAi()}>{docBusy ? 'Analizando…' : 'Analizar con IA'}</button>
            </div>
            {docErr && <p className="err">{docErr}</p>}
            {docReport ? <div className="report">{docReport.split('\n').map((l, i) => <p key={i}>{l}</p>)}</div> : <p className="muted">Pulsa "Analizar con IA" para un informe crítico del guion (usa tu clave BYOK).</p>}
          </div>
          <div className="block panelbox">
            <h2>Hallazgos (heurísticas locales, sin IA)</h2>
            {dr.findings.length === 0 && <p className="muted">Nada que señalar.</p>}
            <ul className="bullets">{dr.findings.map((f, i) => <li key={i} className={f.level === 'warn' ? 'warn' : ''}>{f.scene !== undefined ? <b>E{f.scene + 1} · </b> : null}{f.message}</li>)}</ul>
          </div>
          <div className="block panelbox">
            <h2>Diálogo vs acción por escena</h2>
            {dr.stats.map((s) => (
              <div key={s.index} className="bar" title={`${s.heading}: ${s.dialogue} diálogo / ${s.action} acción`}>
                <span className="tiny muted">E{s.index + 1}</span>
                <div className="barbox">
                  <div style={{ width: `${(s.dialogue / maxW) * 100}%`, background: '#4f8cff' }} />
                  <div style={{ width: `${(s.action / maxW) * 100}%`, background: '#c47d1a' }} />
                </div>
                <span className="tiny muted">{s.words}</span>
              </div>
            ))}
            <div className="legend tiny"><span className="sw" style={{ background: '#4f8cff' }} /> diálogo <span className="sw" style={{ background: '#c47d1a' }} /> acción</div>
          </div>
        </div>
      )}
    </main>
  )
}
