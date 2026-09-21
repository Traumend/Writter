import { useEffect, useMemo, useRef, useState } from 'react'
import { LIBRARY } from '../../core/library'
import { PLANNING_PATH, readPlanning } from '../../core/planning'
import { t } from '../i18n'
import { useStore, type PlanTab } from '../store'
import { Icon } from '../ui'
import { exportProjectJson, importProjectJson } from '../portable'

type Hit = { group: string; label: string; hint?: string; run: () => void }
const KIND_LABEL: Record<string, string> = { script: 'Episodios', character: 'Personajes', location: 'Locaciones', prop: 'Ítems', outline: 'Escaleta', knowledge: 'Notas', other: 'Otros' }

// Paleta global (Ctrl+K): busca en escenas, fichas, notas, preguntas, plants, ideas y biblioteca; con ">" ejecuta comandos.
export function Palette() {
  const s = useStore()
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if (s.paletteOpen) { setQ(''); setI(0); setTimeout(() => ref.current?.focus(), 0) } }, [s.paletteOpen])

  const hits = useMemo((): Hit[] => {
    const close = () => s.setPaletteOpen(false)
    const go = (tab: PlanTab) => { s.setTab('plan'); s.setPlanTab(tab) }
    if (q.startsWith('>')) {
      const cmds: Hit[] = [
        { group: 'Comando', label: t('Nueva nota rápida'), hint: 'Ctrl+Shift+N', run: () => { close(); s.setQuickNoteOpen(true) } },
        { group: 'Comando', label: t('Abrir Dashboard'), run: () => { close(); go('dashboard') } },
        { group: 'Comando', label: t('Abrir Planner'), run: () => { close(); go('planner') } },
        { group: 'Comando', label: t('Abrir Clinic'), run: () => { close(); go('clinic') } },
        { group: 'Comando', label: s.pomo.running ? t('Pausar Pomodoro') : t('Iniciar Pomodoro'), run: () => { close(); s.pomoToggle() } },
        { group: 'Comando', label: t('Exportar proyecto (JSON)'), run: () => { close(); void exportProjectJson() } },
        { group: 'Comando', label: t('Importar proyecto (JSON)'), run: () => { close(); void importProjectJson() } },
        { group: 'Comando', label: t('Preferencias…'), run: () => { close(); s.openPrefs() } },
        { group: 'Comando', label: t('Buscar y reemplazar…'), run: () => { close(); s.openSearch() } }
      ]
      const ql = q.slice(1).trim().toLowerCase()
      return cmds.filter((c) => !ql || c.label.toLowerCase().includes(ql))
    }
    const ql = q.trim().toLowerCase()
    if (!ql) return []
    const out: Hit[] = []
    for (const f of s.files) {
      const d = s.docs.find((x) => x.path === f.path)
      const inName = f.name.toLowerCase().includes(ql)
      const idx = d ? d.content.toLowerCase().indexOf(ql) : -1
      if (!inName && idx < 0) continue
      const hint = idx >= 0 && d ? '…' + d.content.slice(Math.max(0, idx - 30), idx + 40).replace(/\n/g, ' ') + '…' : undefined
      const line = idx >= 0 && d ? d.content.slice(0, idx).split('\n').length - 1 : 0
      out.push({ group: t(KIND_LABEL[f.kind] ?? f.kind), label: f.name, hint, run: () => { close(); void s.openFile(f.path, line); s.setTab('desk') } })
      if (out.length > 40) break
    }
    // Escenas por encabezado.
    for (const f of s.files.filter((x) => x.kind === 'script')) {
      const d = s.docs.find((x) => x.path === f.path); if (!d) continue
      d.content.split('\n').forEach((ln, n) => { if (/^(INT|EXT|EST|I\/E)[.\s]/i.test(ln.trim()) && ln.toLowerCase().includes(ql)) out.push({ group: t('Escenas'), label: ln.trim(), hint: f.name, run: () => { close(); void s.openFile(f.path, n); s.setTab('desk') } }) })
    }
    const pl = readPlanning(s.docs.find((d) => d.path === PLANNING_PATH)?.content)
    for (const x of pl.questions) if (x.text.toLowerCase().includes(ql)) out.push({ group: t('Preguntas'), label: x.text, run: () => { close(); go('questions') } })
    for (const x of pl.plants) if (x.title.toLowerCase().includes(ql)) out.push({ group: 'Plant & Payoff', label: x.title, run: () => { close(); go('plants') } })
    for (const x of pl.ideas) if ((x.title + ' ' + x.summary).toLowerCase().includes(ql)) out.push({ group: t('Ideas'), label: x.title, run: () => { close(); go('ideas') } })
    for (const e of LIBRARY) if ((e.title + ' ' + e.summary).toLowerCase().includes(ql)) out.push({ group: t('Biblioteca'), label: e.title, hint: e.category, run: () => { close(); go('library') } })
    return out.slice(0, 60)
  }, [q, s.files, s.docs, s.pomo.running])

  useEffect(() => setI(0), [q])
  if (!s.paletteOpen) return null
  const groups = [...new Set(hits.map((h) => h.group))]
  return (
    <div className="modal-backdrop" onClick={() => s.setPaletteOpen(false)}>
      <div className="modal cmdpal" onClick={(e) => e.stopPropagation()}>
        <div className="row"><Icon name="search" size={16} /><input ref={ref} placeholder={t('Buscar en todo… (">" para comandos)')} value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(hits.length - 1, x + 1)) } else if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(0, x - 1)) } else if (e.key === 'Enter') hits[i]?.run(); else if (e.key === 'Escape') s.setPaletteOpen(false) }} /></div>
        <div className="scroll" style={{ maxHeight: '52vh' }}>
          {q && hits.length === 0 && <p className="muted tiny">{t('Sin resultados.')}</p>}
          {!q && <p className="muted tiny">{t('Escribe para buscar en escenas, fichas, notas, preguntas, plants, ideas y biblioteca. Usa ">" para comandos.')}</p>}
          {groups.map((g) => (
            <div key={g}>
              <div className="menu-label">{g}</div>
              {hits.map((h, k) => h.group === g && (
                <div key={k} className={`hit ${k === i ? 'on' : ''}`} onMouseEnter={() => setI(k)} onClick={h.run}>
                  <span className="ell">{h.label}</span>{h.hint && <span className="muted tiny ell">{h.hint}</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
