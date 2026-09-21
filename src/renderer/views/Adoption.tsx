import { useEffect, useState } from 'react'
import type { AdoptRole } from '../../core/types/ipc'
import { t } from '../i18n'
import { useStore } from '../store'

// Vinculador de carpetas del Vault (role-first): la raíz arriba y, por cada rol, su subcarpeta
// con la ruta completa debajo, botón para crear si no existe y para examinar. Lo más intuitivo posible.
const ROLES: [AdoptRole, string, string][] = [
  ['script', 'Guiones', 'Episodios y escenas (.md con Fountain)'],
  ['character', 'Personajes', 'Fichas de personaje'],
  ['location', 'Locaciones', 'Lugares y escenarios'],
  ['prop', 'Props / Utilería', 'Objetos y vestuario'],
  ['outline', 'Escaleta', 'Actos, beats y notas'],
  ['knowledge', 'Conocimiento', 'Biblia, reglas del mundo, referencias'],
  ['assets', 'Assets', 'Imágenes y storyboards']
]

const join = (root: string, rel: string) => {
  const sep = root.includes('\\') ? '\\' : '/'
  return `${root.replace(/[\\/]$/, '')}${sep}${rel.replace(/\//g, sep)}`
}

function RoleRow({ role, label, desc, root, value, onChange }: { role: AdoptRole; label: string; desc: string; root: string; value: string; onChange: (v: string) => void }) {
  const [exists, setExists] = useState<boolean | null>(null)
  const check = () => window.api.folderExists(root, value).then(setExists)
  useEffect(() => { setExists(null); if (value.trim()) void check() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [value, root])
  const create = async () => { await window.api.folderMake(root, value); await check() }
  const browse = async () => { const rel = await window.api.folderPick(root); if (rel !== null) onChange(rel) }
  return (
    <div className="linkrow">
      <div className="linkrow-head">
        <div className="grow">
          <strong>{t(label)}</strong>
          <span className="muted tiny"> · {t(desc)}</span>
        </div>
        {exists === true && <span className="badge ok">✓ {t('existe')}</span>}
        {exists === false && <span className="badge no">{t('no existe')}</span>}
      </div>
      <div className="row">
        <input value={value} placeholder={t('subcarpeta…')} onChange={(e) => onChange(e.target.value)} aria-label={`${t('Carpeta de')} ${t(label)}`} />
        <button className="ghost" onClick={() => void browse()}>{t('Examinar…')}</button>
        {exists === false && <button onClick={() => void create()}>{t('Crear')}</button>}
      </div>
      <div className="linkpath tiny muted">{join(root, value)}</div>
    </div>
  )
}

export function Adoption() {
  const { linker, linkVault, cancelLink, repickRoot } = useStore()
  const [roles, setRoles] = useState<Record<AdoptRole, string>>({} as Record<AdoptRole, string>)
  useEffect(() => { if (linker) setRoles(linker.roles) }, [linker])
  if (!linker) return null
  const set = (k: AdoptRole, v: string) => setRoles((r) => ({ ...r, [k]: v }))
  return (
    <div className="modal-backdrop" onClick={cancelLink}>
      <div className="modal linker" onClick={(e) => e.stopPropagation()}>
        <div className="row"><h1>{t('Vincular carpetas del Vault')}</h1><span className="grow" /><button className="mini ghost" onClick={cancelLink}>{t('Cerrar')}</button></div>
        <p className="muted">{t('Indica dónde vive cada cosa. Si una carpeta no existe, créala con un botón. No se mueve ni se modifica contenido.')}</p>

        <div className="linkrow root">
          <div className="linkrow-head"><strong>{t('Vault principal (raíz)')}</strong><span className="grow" /><button className="mini ghost" onClick={() => void repickRoot()}>{t('Cambiar…')}</button></div>
          <div className="linkpath mono">{linker.root}</div>
        </div>

        <div className="scroll" style={{ maxHeight: '52vh' }}>
          {ROLES.map(([role, label, desc]) => (
            <RoleRow key={role} role={role} label={label} desc={desc} root={linker.root} value={roles[role] ?? ''} onChange={(v) => set(role, v)} />
          ))}
        </div>

        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
          <button className="ghost" onClick={cancelLink}>{t('Cancelar')}</button>
          <button onClick={() => void linkVault(roles)}>{t('Vincular y abrir')}</button>
        </div>
      </div>
    </div>
  )
}
