import { useEffect, useState } from 'react'
import { foldersToRoles } from '../../core/adopt'
import type { AdoptRole, FolderGuess } from '../../core/types/ipc'
import { useStore } from '../store'

const ROLES: (AdoptRole | 'ignore')[] = ['script', 'character', 'location', 'prop', 'outline', 'knowledge', 'assets', 'ignore']
const LABEL: Record<AdoptRole | 'ignore', string> = {
  script: 'Guiones', character: 'Personajes', location: 'Locaciones', prop: 'Props', outline: 'Escaleta', knowledge: 'Conocimiento', assets: 'Assets', ignore: 'Ignorar'
}

// Asistente de adopción (Pieza 1): el usuario indica qué es cada carpeta. Solo lectura hasta confirmar.
export function Adoption() {
  const { adoption, adopt, cancelAdopt } = useStore()
  const [folders, setFolders] = useState<FolderGuess[]>([])
  useEffect(() => {
    if (adoption) setFolders(adoption.folders)
  }, [adoption])
  if (!adoption) return null
  const setRole = (i: number, role: AdoptRole | 'ignore') => setFolders((f) => f.map((x, j) => (j === i ? { ...x, role } : x)))
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h1>Adoptar proyecto</h1>
        <p className="muted crumb">{adoption.root}</p>
        <p>Writter encontró estas carpetas con contenido. Indica qué es cada una. No se mueve ni se modifica nada, solo se registra dónde está cada cosa.</p>
        <div className="scroll" style={{ maxHeight: '50vh' }}>
          <table className="table">
            <thead><tr><th>Carpeta</th><th>Contenido</th><th>Es…</th></tr></thead>
            <tbody>
              {folders.map((f, i) => (
                <tr key={f.path}>
                  <td>{f.path === '.' ? '(raíz)' : f.path}</td>
                  <td className="muted tiny">{f.hint}</td>
                  <td>
                    <select value={f.role} onChange={(e) => setRole(i, e.target.value as AdoptRole | 'ignore')}>
                      {ROLES.map((r) => <option key={r} value={r}>{LABEL[r]}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="ghost" onClick={cancelAdopt}>Cancelar</button>
          <button onClick={() => void adopt(foldersToRoles(folders))}>Adoptar</button>
        </div>
      </div>
    </div>
  )
}
