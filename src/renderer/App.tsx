import { Analysis } from './views/Analysis'
import { BeatTimeline } from './views/BeatTimeline'
import { Breakdown } from './views/Breakdown'
import { Characters } from './views/Characters'
import { Desk } from './views/Desk'
import { NeuralMap } from './views/NeuralMap'
import { Production } from './views/Production'
import { Settings } from './views/Settings'
import { useStore, type DevTab, type Tab } from './store'

const TABS: [Tab, string][] = [['desk', 'Escritorio'], ['breakdown', 'Breakdown'], ['dev', 'Desarrollo'], ['production', 'Producción'], ['settings', 'Ajustes']]
const DEV: [DevTab, string][] = [['characters', 'Personajes'], ['beats', 'Beat Timeline'], ['map', 'Mapa neural'], ['analysis', 'Análisis']]

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
      </header>
      {s.tab === 'desk' && <Desk />}
      {s.tab === 'breakdown' && <Breakdown />}
      {s.tab === 'dev' && s.devTab === 'characters' && <Characters />}
      {s.tab === 'dev' && s.devTab === 'beats' && <BeatTimeline />}
      {s.tab === 'dev' && s.devTab === 'map' && <NeuralMap />}
      {s.tab === 'dev' && s.devTab === 'analysis' && <Analysis />}
      {s.tab === 'production' && <Production />}
      {s.tab === 'settings' && <Settings />}
      <footer>
        <span>{s.status || '—'}</span>
        <span className="grow" />
        {s.path && <span>{s.projection.wordCount} palabras · ≈ {Math.ceil(s.text.length / 4)} tokens · {s.pagination.pages} pág.</span>}
        <span>BYOK: {provider} {s.keyStatus?.present || provider === 'ollama' ? '●' : '○'}</span>
      </footer>
    </>
  )
}
