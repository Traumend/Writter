import { useState } from 'react'
import type { KeyStatus, VaultSummary } from '../core/types/ipc'

export function App() {
  const [vault, setVault] = useState<VaultSummary | null>(null)
  const [file, setFile] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [saved, setSaved] = useState(true)
  const [keyStatus, setKeyStatus] = useState<KeyStatus | null>(null)
  const [keyInput, setKeyInput] = useState('')

  const provider = vault?.config.byok.provider ?? 'anthropic'

  async function openVault() {
    const v = await window.api.vaultOpen()
    if (!v) return
    setVault(v)
    setFile(null)
    setText('')
    setKeyStatus(await window.api.keysStatus(v.config.byok.provider))
  }

  async function openFile(path: string) {
    const { content } = await window.api.fileRead(path)
    setFile(path)
    setText(content)
    setSaved(true)
  }

  async function save() {
    if (!file) return
    await window.api.fileWrite(file, text)
    setSaved(true)
  }

  async function saveKey() {
    if (!keyInput) return
    setKeyStatus(await window.api.keysSet(provider, keyInput))
    setKeyInput('')
  }

  return (
    <>
      <header>
        <strong>Writter</strong>
        <span className="muted">{vault ? vault.root : 'Sin proyecto'}</span>
        <span className="grow" />
        <button onClick={openVault}>Abrir vault</button>
      </header>
      <main>
        <aside>
          <h2>Guiones</h2>
          {!vault && <p className="muted">Abre una carpeta como vault.</p>}
          {vault && vault.scripts.length === 0 && <p className="muted">Sin guiones en scripts/. Crea un .md en Obsidian o aquí (M1).</p>}
          {vault && vault.scripts.length > 0 && (
            <ul>
              {vault.scripts.map((s) => (
                <li key={s} className={s === file ? 'active' : ''} onClick={() => openFile(s)}>
                  {s.replace('scripts/', '')}
                </li>
              ))}
            </ul>
          )}
        </aside>
        <section>
          {file ? (
            <textarea
              value={text}
              spellCheck={false}
              onChange={(e) => {
                setText(e.target.value)
                setSaved(false)
              }}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                  e.preventDefault()
                  void save()
                }
              }}
            />
          ) : (
            <p className="muted">Selecciona un guión. El editor CodeMirror con formateo en vivo llega en M1.</p>
          )}
        </section>
        <aside className="right">
          <h2>Clave BYOK · {provider}</h2>
          <p className="muted">{keyStatus?.present ? 'Clave guardada en el keychain del SO.' : 'Sin clave.'}</p>
          <input
            type="password"
            placeholder="Pegar clave y Enter"
            value={keyInput}
            disabled={!vault}
            onChange={(e) => setKeyInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveKey()}
          />
        </aside>
      </main>
      <footer>
        <span>{file ? (saved ? 'Guardado' : 'Sin guardar · Ctrl+S') : '—'}</span>
        <span className="grow" />
        <span>
          BYOK: {provider} {keyStatus?.present ? '●' : '○'}
        </span>
      </footer>
    </>
  )
}
