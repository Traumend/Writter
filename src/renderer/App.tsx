import { Editor } from './editor/Editor'
import { LeftPanel, RightPanel, ScopeBar } from './panels'
import { useStore } from './store'

export function App() {
  const s = useStore()
  const provider = s.vault?.config.byok.provider ?? 'anthropic'
  return (
    <>
      <header>
        <strong>Writter</strong>
        <span className="muted">{s.vault ? s.vault.root : 'Sin proyecto'}</span>
        {s.path && <span className="crumb">{s.path}</span>}
        <span className="grow" />
        {s.graph && <span className="pill" title={s.graph.reason}>índice {s.graph.stale ? 'reindexando' : 'al día'}</span>}
        <button className="ghost" onClick={() => void s.openVault()}>Abrir vault</button>
      </header>
      <main>
        <aside><LeftPanel /></aside>
        <section>
          {s.conflict && (
            <div className="banner">
              El archivo cambió en disco mientras lo editabas.
              <button className="mini" onClick={() => void s.reloadFromDisk()}>Recargar del disco</button>
              <button className="mini ghost" onClick={() => void s.save(true)}>Conservar lo mío</button>
            </div>
          )}
          {s.path ? (
            <>
              <ScopeBar />
              <Editor />
            </>
          ) : (
            <p className="muted center">Selecciona o crea un archivo. Ctrl+clic en un [[enlace]] abre la ficha.</p>
          )}
        </section>
        <aside className="right"><RightPanel /></aside>
      </main>
      <footer>
        <span>{s.status || '—'}</span>
        <span className="grow" />
        <span>BYOK: {provider} {s.keyStatus?.present || provider === 'ollama' ? '●' : '○'}</span>
      </footer>
    </>
  )
}
