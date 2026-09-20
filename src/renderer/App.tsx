import { useEffect, useRef, useState } from 'react'
import { Adoption } from './views/Adoption'
import { Analysis } from './views/Analysis'
import { BeatTimeline } from './views/BeatTimeline'
import { Preferences } from './views/Preferences'
import { Breakdown } from './views/Breakdown'
import { Characters } from './views/Characters'
import { Desk } from './views/Desk'
import { NeuralMap } from './views/NeuralMap'
import { Production } from './views/Production'
import { Settings } from './views/Settings'
import { useStore, type DevTab, type Tab } from './store'

const TABS: [Tab, string][] = [['desk', 'Escritorio'], ['breakdown', 'Breakdown'], ['dev', 'Desarrollo'], ['production', 'Producción'], ['settings', 'Ajustes']]
const DEV: [DevTab, string][] = [['characters', 'Personajes'], ['beats', 'Beat Timeline'], ['map', 'Mapa neural'], ['analysis', 'Análisis']]

// Menú desplegable de la barra superior (estilo suite Adobe).
function AppMenu() {
  const { openVault, openPrefs, setTab, openLinker, vault } = useStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])
  const item = (label: string, fn: () => void) => (
    <button className="menu-item" onClick={() => { setOpen(false); fn() }}>{label}</button>
  )
  return (
    <div className="appmenu" ref={ref}>
      <button className="ghost" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>☰ Menú</button>
      {open && (
        <div className="menu" role="menu">
          {item('Preferencias…', openPrefs)}
          {item('Abrir vault…', () => void openVault())}
          {vault && item('Vincular carpetas…', openLinker)}
          {item('Ajustes del proyecto', () => setTab('settings'))}
          <div className="menu-sep" />
          {item('Recargar', () => location.reload())}
        </div>
      )}
    </div>
  )
}

export function App() {
  const s = useStore()
  const provider = s.vault?.config.byok.provider ?? 'anthropic'
  return (
    <>
      <header>
        <strong>Writter</strong>
        <nav>
          {TABS.map(([t, l]) => (
            <button key={t} className={s.tab === t ? 'on' : 'ghost'} disabled={!s.vault && t !== 'desk'} onClick={() => s.setTab(t)}>{l}</button>
          ))}
        </nav>
        {s.tab === 'dev' && (
          <nav className="sub">
            {DEV.map(([t, l]) => (
              <button key={t} className={s.devTab === t ? 'on' : 'ghost'} onClick={() => s.setDevTab(t)}>{l}</button>
            ))}
          </nav>
        )}
        <span className="grow" />
        <span className="muted crumb">{s.vault ? s.vault.root.split(/[\\/]/).pop() : 'Sin proyecto'}</span>
        {s.graph && <span className="pill" title={s.graph.reason}>índice {s.graph.stale ? 'reindexando' : 'al día'}</span>}
        <button className="ghost" onClick={() => void s.openVault()}>Abrir vault</button>
        <AppMenu />
      </header>
      {s.tab === 'desk' && <Desk />}
      {s.tab === 'breakdown' && <Breakdown />}
      {s.tab === 'dev' && s.devTab === 'characters' && <Characters />}
      {s.tab === 'dev' && s.devTab === 'beats' && <BeatTimeline />}
      {s.tab === 'dev' && s.devTab === 'map' && <NeuralMap />}
      {s.tab === 'dev' && s.devTab === 'analysis' && <Analysis />}
      {s.tab === 'production' && <Production />}
      {s.tab === 'settings' && <Settings />}
      <Adoption />
      <Preferences />
      <footer>
        <span>{s.status || '—'}</span>
        <span className="grow" />
        {s.path && <span>{s.projection.wordCount} palabras · ≈ {Math.ceil(s.text.length / 4)} tokens · {s.pagination.pages} pág.</span>}
        <span>BYOK: {provider} {s.keyStatus?.present || provider === 'ollama' ? '●' : '○'}</span>
      </footer>
    </>
  )
}
