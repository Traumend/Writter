import { useEffect, useMemo, useRef, useState } from 'react'
import { doctor } from '../../core/doctor'
import { readFrontmatter } from '../../core/frontmatter'
import { parseFountain } from '../../core/parser/fountain'
import { project } from '../../core/projection'
import type { Analysis as A } from '../../core/types/ipc'
import { t } from '../i18n'
import { cleanErr, useStore } from '../store'
import { EpisodeSelect, useDoc } from '../ui'

type Metric = 'intensity' | 'tension' | 'attention' | 'commercial'
const SERIES: [Metric, string, string][] = [
  ['intensity', 'Intensidad emocional', '#e8437f'],
  ['tension', 'Tensión dramática', '#c47d1a'],
  ['attention', 'Captura de atención', '#4f8cff'],
  ['commercial', 'Potencial comercial', '#59c1d6']
]
const BEAT_COLOR: Record<string, string> = { setup: '#4f8cff', payoff: '#3ddc97', twist: '#c47d1a', climax: '#e8437f', surprise: '#b388ff', romance: '#ff8fb1', other: '#8b91a0' }
const EMO = ['#8b91a0', '#e8437f', '#c47d1a', '#4f8cff', '#3ddc97', '#b388ff', '#ff8fb1', '#59c1d6', '#d66b59', '#9bd659']
const emoColor = (e: string) => EMO[[...e.toLowerCase()].reduce((a, c) => a + c.charCodeAt(0), 0) % EMO.length]!

function Chart({ a, cmp, markers, chars, on, onPick, onGo, svgRef, zoom }: { a: A; cmp: A | null; markers: { scene: number; title: string; kind: string }[]; chars: (i: number) => string[]; on: Set<Metric>; onPick: (i: number) => void; onGo: (i: number) => void; svgRef: React.RefObject<SVGSVGElement>; zoom: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 1000, H = 280, L = 36, R = 16, T = 26, B = 28
  const n = Math.max(1, a.scenes.length)
  const x = (i: number) => L + (i / Math.max(1, n - 1)) * (W - L - R)
  const y = (v: number) => T + (1 - v / 10) * (H - T - B)
  const path = (sc: A['scenes'], k: Metric) => sc.map((s, i) => `${i ? 'L' : 'M'}${x(i)},${y(s[k])}`).join(' ')
  const hs = hover !== null ? a.scenes[hover] : null
  return (
    <div className="chartwrap">
      <div className="chartscroll">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: `${W * zoom}px`, height: `${H}px`, display: 'block', minWidth: '100%' }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => { const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W; setHover(Math.max(0, Math.min(n - 1, Math.round(((px - L) / (W - L - R)) * (n - 1))))) }}
        onClick={() => hover !== null && onPick(hover)} onDoubleClick={() => hover !== null && onGo(hover)}>
        {[0, 2, 4, 6, 8, 10].map((v) => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--line)" /><text x={L - 6} y={y(v) + 3} textAnchor="end" fontSize="9" fill="var(--dim)">{v}</text></g>)}
        {a.scenes.map((s, i) => <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="8" fill="var(--dim)">E{s.index + 1}</text>)}
        {/* Marcadores: beats del outline (vínculo con el Beat Timeline) */}
        {markers.map((m, i) => m.scene < n && (
          <g key={i} transform={`translate(${x(m.scene)},${T - 8})`}><polygon points="0,0 4,-7 -4,-7" fill={BEAT_COLOR[m.kind] ?? BEAT_COLOR['other']} /><text x={0} y={-9} textAnchor="middle" fontSize="7" fill={BEAT_COLOR[m.kind] ?? BEAT_COLOR['other']} transform="rotate(-18)">{m.title.slice(0, 14)}</text></g>
        ))}
        {cmp && SERIES.filter(([k]) => on.has(k)).map(([k, , c]) => cmp.scenes.length > 0 && <path key={'c' + k} d={path(cmp.scenes, k)} fill="none" stroke={c} strokeWidth={1} strokeDasharray="4 3" opacity={0.5} />)}
        {SERIES.filter(([k]) => on.has(k)).map(([k, , c]) => (
          <g key={k}>
            <path d={path(a.scenes, k)} fill="none" stroke={c} strokeWidth={2} strokeLinejoin="round" />
            {a.scenes.map((s, i) => <circle key={i} cx={x(i)} cy={y(s[k])} r={hover === i ? 5 : 3} fill={c} stroke="var(--panel)" strokeWidth={2} />)}
          </g>
        ))}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="var(--dim)" strokeDasharray="3 3" />}
      </svg>
      </div>
      {hs && (
        <div className="tooltip">
          <strong>E{hs.index + 1}</strong> · {hs.emotion}
          {SERIES.filter(([k]) => on.has(k)).map(([k, l, c]) => (
            <div key={k}><span className="sw" style={{ background: c }} /> {t(l)}: <b>{hs[k]}/10</b> <span className="minibar"><span style={{ width: `${hs[k] * 10}%`, background: c }} /></span></div>
          ))}
          {chars(hover!).length > 0 && <div className="muted">👥 {chars(hover!).join(', ')}</div>}
          <div className="muted">{hs.summary}</div>
          <div className="muted tiny">{t('doble-clic → ir a la escena')}</div>
        </div>
      )}
    </div>
  )
}

function EditList({ title, items, onChange }: { title: string; items: string[]; onChange: (v: string[]) => void }) {
  const [add, setAdd] = useState('')
  return (
    <div className="block panelbox">
      <h2>{title}</h2>
      <ul className="bullets">
        {items.map((it, i) => (
          <li key={i} className="row"><span className="grow">{it}</span><button className="mini ghost" onClick={() => onChange(items.filter((_, j) => j !== i))}>×</button></li>
        ))}
      </ul>
      <input placeholder={t('Añadir nota · Enter')} value={add} onChange={(e) => setAdd(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && add.trim()) { onChange([...items, add.trim()]); setAdd('') } }} />
    </div>
  )
}

export function Analysis() {
  const { files, docs, openFile, setTab } = useStore()
  const scripts = files.filter((f) => f.kind === 'script')
  const [ep, setEp] = useState<string | null>(scripts[0]?.path ?? null)
  const script = ep ?? scripts[0]?.path ?? null
  const doc = useDoc(script)
  const outline = useDoc(script ? `outline/${script.split('/').pop()!}` : null)
  const [list, setList] = useState<{ id: string; ts: number }[]>([])
  const [cur, setCur] = useState<A | null>(null)
  const [cmp, setCmp] = useState<A | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [pick, setPick] = useState<number | null>(null)
  const [tab, setTab2] = useState<'ai' | 'doctor'>('ai')
  const [on, setOn] = useState<Set<Metric>>(new Set(['intensity', 'tension', 'attention']))
  const [zoom, setZoom] = useState(1)
  const [docFocus, setDocFocus] = useState('')
  const [docReport, setDocReport] = useState('')
  const [docBusy, setDocBusy] = useState(false)
  const [docErr, setDocErr] = useState('')
  const svgRef = useRef<SVGSVGElement>(null)

  const proj = useMemo(() => project(parseFountain(doc?.content ?? '')), [doc?.content])
  const beats = useMemo(() => (outline ? (readFrontmatter(outline.content).data['beats'] as { scene: number; title: string; kind: string }[] | undefined) ?? [] : []), [outline])
  const charsAt = (i: number) => proj.scenes[i]?.characters ?? []
  const goScene = (i: number) => { if (script && proj.scenes[i]) { void openFile(script, proj.scenes[i]!.startLine); setTab('desk') } }

  useEffect(() => {
    setCur(null); setCmp(null); setDocReport('')
    if (!script) return
    void window.api.analysisList(script).then((l) => { setList(l); if (l[0]) void window.api.analysisRead(script, l[0].id).then(setCur) })
  }, [script])

  const saveCur = (patch: Partial<A>) => { if (!script || !cur) return; const next = { ...cur, ...patch }; setCur(next); void window.api.analysisSave(script, cur.id, next) }

  const run = async () => {
    if (!script || !doc) return
    setBusy(true); setErr('')
    try { const a = await window.api.aiAnalyze(script, doc.content); setCur(a); setList(await window.api.analysisList(script)) } catch (e) { setErr(cleanErr(e)) } finally { setBusy(false) }
  }
  const runDoctorAi = async () => {
    if (!doc) return
    setDocBusy(true); setDocErr('')
    try { setDocReport((await window.api.aiDoctor(doc.content, docFocus)).text) } catch (e) { setDocErr(cleanErr(e)) } finally { setDocBusy(false) }
  }

  const exportHtml = () => {
    if (!cur) return
    const esc = (s: string) => s.replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]!))
    const rows = cur.scenes.map((s) => `<tr><td>E${s.index + 1}</td><td>${esc(s.emotion)}</td><td>${s.intensity}</td><td>${s.tension}</td><td>${s.attention}</td><td>${s.commercial}</td><td>${esc(s.summary)}</td></tr>`).join('')
    const html = `<html><meta charset=utf8><body style="font-family:system-ui;max-width:900px;margin:auto"><h1>${esc(script ?? '')}</h1><p><b>Estructura:</b> ${esc(cur.structure)}</p><p><b>Trama:</b> ${esc(cur.plot)}</p><p><b>Tema:</b> ${esc(cur.theme)}</p><p><b>Tono:</b> ${esc(cur.tone)}</p><h3>Notas</h3><ul>${cur.notes.map((x) => `<li>${esc(x)}</li>`).join('')}</ul><table border=1 cellpadding=4><tr><th>Escena</th><th>Emoción</th><th>Int</th><th>Tens</th><th>Aten</th><th>Com</th><th>Resumen</th></tr>${rows}</table></body></html>`
    void window.api.exportText(html, `${script?.split('/').pop()?.replace(/\.md$/, '')}-analisis.html`)
  }
  const exportPng = () => {
    const svg = svgRef.current
    if (!svg) return
    const xml = new XMLSerializer().serializeToString(svg)
    const img = new Image()
    img.onload = () => {
      const cv = document.createElement('canvas'); cv.width = 1400; cv.height = 392
      const ctx = cv.getContext('2d')!; ctx.fillStyle = '#171a21'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.drawImage(img, 0, 0, cv.width, cv.height)
      void window.api.exportBytes(cv.toDataURL('image/png').split(',')[1]!, `${script?.split('/').pop()?.replace(/\.md$/, '')}-timeline.png`)
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)))
  }

  const known = useMemo(() => new Set(files.filter((f) => f.kind !== 'script').map((f) => f.name.toLowerCase())), [files])
  const dr = useMemo(() => { const p = parseFountain(doc?.content ?? ''); return doctor(p, project(p), known) }, [doc?.content, known])
  const maxW = Math.max(1, ...dr.stats.map((s) => s.dialogue + s.action))

  return (
    <main className="page scroll">
      <div className="toolbar wrap">
        <EpisodeSelect value={script} onChange={setEp} />
        <button className={tab === 'ai' ? 'on' : 'ghost'} onClick={() => setTab2('ai')}>{t('Análisis IA')}</button>
        <button className={tab === 'doctor' ? 'on' : 'ghost'} onClick={() => setTab2('doctor')}>Script Doctor ({dr.findings.length})</button>
        <span className="grow" />
        {tab === 'ai' && list.length > 0 && (
          <select value={cur?.id ?? ''} onChange={(e) => script && void window.api.analysisRead(script, e.target.value).then(setCur)} title={t('Versión')}>
            {list.map((l) => <option key={l.id} value={l.id}>{new Date(l.ts).toLocaleString()}</option>)}
          </select>
        )}
        {tab === 'ai' && list.length > 1 && (
          <select value={cmp?.id ?? ''} onChange={(e) => { if (!e.target.value) setCmp(null); else script && void window.api.analysisRead(script, e.target.value).then(setCmp) }} title={t('Comparar con')}>
            <option value="">{t('Comparar con…')}</option>
            {list.filter((l) => l.id !== cur?.id).map((l) => <option key={l.id} value={l.id}>{new Date(l.ts).toLocaleString()}</option>)}
          </select>
        )}
        {tab === 'ai' && cur && <><button className="mini ghost" onClick={exportPng}>PNG</button><button className="mini ghost" onClick={exportHtml}>HTML</button></>}
        {tab === 'ai' && <button disabled={!doc || busy} onClick={() => void run()}>{busy ? t('Analizando…') : t('Analizar con IA')}</button>}
      </div>
      {err && <p className="err">{err}</p>}

      {tab === 'ai' && !cur && <p className="muted center">{t('Sin análisis para este episodio. Pulsa "Analizar con IA" (usa tu clave BYOK; el resultado se guarda en .narrative/analysis).')}</p>}
      {tab === 'ai' && cur && (
        <>
          <div className="grid2">
            <div className="block panelbox">
              {([['structure', 'Estructura'], ['plot', 'Trama'], ['theme', 'Tema'], ['tone', 'Tono']] as const).map(([k, l]) => (
                <label className="field" key={k}><span>{t(l)}</span><textarea rows={2} value={cur[k]} onChange={(e) => saveCur({ [k]: e.target.value } as Partial<A>)} /></label>
              ))}
              <p className="muted tiny">{t('Editable · se guarda automáticamente')} · {cur.model}</p>
            </div>
            <EditList title={t('Notas')} items={cur.notes} onChange={(v) => saveCur({ notes: v })} />
          </div>

          <div className="row" style={{ alignItems: 'center', marginTop: 6 }}>
            {SERIES.map(([k, l, c]) => <label key={k} className="check"><input type="checkbox" checked={on.has(k)} onChange={() => setOn((s) => { const m = new Set(s); m.has(k) ? m.delete(k) : m.add(k); return m })} /><span className="sw" style={{ background: c }} /> {t(l)}</label>)}
            <span className="grow" />
            <span className="muted tiny">{t('Zoom')}</span>
            <input type="range" min={1} max={4} step={0.5} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ width: 120 }} />
            <button className="mini ghost" onClick={() => setZoom(1)}>{t('Ajustar')}</button>
          </div>
          <h2>{t('Timeline — métricas del guion')}</h2>
          <Chart a={cur} cmp={cmp} markers={beats} chars={charsAt} on={on} onPick={setPick} onGo={goScene} svgRef={svgRef} zoom={zoom} />

          <h2>{t('Paleta de emociones')}</h2>
          <div className="palette">
            {cur.scenes.map((s) => (
              <div key={s.index} className="emo" style={{ background: emoColor(s.emotion) }} title={`E${s.index + 1}: ${s.emotion}`} onClick={() => setPick(s.index)} onDoubleClick={() => goScene(s.index)}><span>E{s.index + 1}</span><b>{s.emotion}</b></div>
            ))}
          </div>

          <div className="grid2">
            <EditList title={t('Escritura')} items={cur.writing} onChange={(v) => saveCur({ writing: v })} />
            <EditList title={t('Texto y formato')} items={cur.format} onChange={(v) => saveCur({ format: v })} />
          </div>

          {pick !== null && cur.scenes[pick] && (
            <div className="block panelbox">
              <h2>E{cur.scenes[pick]!.index + 1} · {cur.scenes[pick]!.emotion} <button className="mini ghost" onClick={() => goScene(pick)}>{t('Abrir en Escritorio')}</button></h2>
              <div className="muted tiny">👥 {charsAt(pick).join(', ') || '—'}</div>
              <p>{cur.scenes[pick]!.summary}</p>
              <ul className="bullets">{cur.scenes[pick]!.notes.map((nt, i) => <li key={i}>{nt}</li>)}</ul>
            </div>
          )}
          <details>
            <summary className="muted">{t('Tabla de datos')}</summary>
            <table className="table">
              <thead><tr><th>{t('Escena')}</th><th>{t('Emoción')}</th>{SERIES.map(([k, l]) => <th key={k}>{t(l)}</th>)}<th>{t('Resumen')}</th></tr></thead>
              <tbody>{cur.scenes.map((s) => <tr key={s.index}><td>E{s.index + 1}</td><td>{s.emotion}</td>{SERIES.map(([k]) => <td key={k}>{s[k]}</td>)}<td>{s.summary}</td></tr>)}</tbody>
            </table>
          </details>
        </>
      )}

      {tab === 'doctor' && (
        <div className="grid2">
          <div className="block panelbox">
            <div className="row"><h2>{t('Diagnóstico con IA')}</h2><span className="grow" />
              <input style={{ width: 220 }} placeholder={t('Enfoque (ritmo, diálogo…)')} value={docFocus} onChange={(e) => setDocFocus(e.target.value)} />
              <button disabled={!doc || docBusy} onClick={() => void runDoctorAi()}>{docBusy ? t('Analizando…') : t('Analizar con IA')}</button>
            </div>
            {docErr && <p className="err">{docErr}</p>}
            {docReport ? <div className="report">{docReport.split('\n').map((l, i) => <p key={i}>{l}</p>)}</div> : <p className="muted">{t('Pulsa "Analizar con IA" para un informe crítico del guion (usa tu clave BYOK).')}</p>}
          </div>
          <div className="block panelbox">
            <h2>{t('Hallazgos (heurísticas locales, sin IA)')}</h2>
            {dr.findings.length === 0 && <p className="muted">{t('Nada que señalar.')}</p>}
            <ul className="bullets">{dr.findings.map((f, i) => <li key={i} className={f.level === 'warn' ? 'warn' : ''}>{f.scene !== undefined ? <b>E{f.scene + 1} · </b> : null}{f.message}</li>)}</ul>
          </div>
          <div className="block panelbox">
            <h2>{t('Diálogo vs acción por escena')}</h2>
            {dr.stats.map((s) => (
              <div key={s.index} className="bar" title={`${s.heading}: ${s.dialogue} ${t('diálogo')} / ${s.action} ${t('acción')}`}>
                <span className="tiny muted">E{s.index + 1}</span>
                <div className="barbox"><div style={{ width: `${(s.dialogue / maxW) * 100}%`, background: '#4f8cff' }} /><div style={{ width: `${(s.action / maxW) * 100}%`, background: '#c47d1a' }} /></div>
                <span className="tiny muted">{s.words}</span>
              </div>
            ))}
            <div className="legend tiny"><span className="sw" style={{ background: '#4f8cff' }} /> {t('diálogo')} <span className="sw" style={{ background: '#c47d1a' }} /> {t('acción')}</div>
          </div>
        </div>
      )}
    </main>
  )
}
