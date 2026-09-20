import { useEffect, useMemo, useState } from 'react'
import { countEntity } from '../../core/rename'
import { t } from '../i18n'
import { useStore } from '../store'

// Renombrado inteligente (Nivel 2): renombra la entidad y sus alias en todo el vault, con vista previa.
export function Rename() {
  const { rename, closeRename, applyRename, docs } = useStore()
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => setTo(rename?.name ?? ''), [rename])
  const counts = useMemo(() => (rename ? countEntity(docs, rename.terms) : []), [rename, docs])
  if (!rename) return null
  const total = counts.reduce((a, c) => a + c.count, 0)
  const go = async () => { setBusy(true); try { await applyRename(to.trim()) } finally { setBusy(false) } }
  return (
    <div className="modal-backdrop" onClick={closeRename}>
      <div className="modal" style={{ width: 'min(520px,92vw)' }} onClick={(e) => e.stopPropagation()}>
        <div className="row"><h1>{t('Renombrar entidad')}</h1><span className="grow" /><button className="ghost mini" onClick={closeRename}>{t('Cerrar')}</button></div>
        <p className="muted">{t('Cambia')} <strong>{rename.name}</strong>{rename.terms.length > 1 ? ` ${t('y sus alias')} (${rename.terms.slice(1).join(', ')})` : ''} {t('en todo el vault. Conserva mayúsculas de los cues y actualiza los enlaces [[ ]] y la ficha.')}</p>
        <label className="field"><span>{t('Nuevo nombre')}</span><input autoFocus value={to} onChange={(e) => setTo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && to.trim() && void go()} /></label>
        <p className="muted tiny">{total} {t('aparición(es) en')} {counts.length} {t('archivo(s).')}</p>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
          <button className="ghost" onClick={closeRename}>{t('Cancelar')}</button>
          <button disabled={busy || !to.trim() || to.trim() === rename.name} onClick={() => void go()}>{t('Renombrar')}</button>
        </div>
      </div>
    </div>
  )
}
