import { useState } from 'react'
import { t } from '../i18n'
import { ACCENTS, useStore, type AccentName, type Scale } from '../store'

const TAB_LABEL: Record<string, string> = { desk: 'Escritorio', breakdown: 'Breakdown', dev: 'Desarrollo', production: 'Producción' }
const ROLE_PRESETS: [string, string[]][] = [
  ['Completo', ['desk', 'breakdown', 'dev', 'production']],
  ['Escritor', ['desk', 'breakdown', 'dev']],
  ['Director', ['desk', 'breakdown', 'dev', 'production']],
  ['Productor', ['breakdown', 'production']]
]

// Preferencias de interfaz (estilo suite Adobe): categorías a la izquierda, ajustes a la derecha.
// Solo tocan la apariencia local; la configuración del proyecto vive en la pestaña Ajustes.
const ACCENT_LABEL: Record<AccentName, string> = { naranja: 'Naranja', ambar: 'Ámbar', azul: 'Azul', verde: 'Verde', rosa: 'Rosa' }
const SCALES: [Scale, string][] = [['compact', 'Compacta'], ['normal', 'Normal'], ['large', 'Grande']]
const CATS = ['Interfaz', 'Editor'] as const

export function Preferences() {
  const { prefsOpen, closePrefs, prefs, setPref, showTags, toggleTags, resetLayout, tab, setTab } = useStore()
  const setTabs = (tabs: string[]) => {
    setPref('tabs', tabs)
    if (tab !== 'settings' && !tabs.includes(tab)) setTab('desk')
  }
  const toggleTab = (t: string) => setTabs(prefs.tabs.includes(t) ? prefs.tabs.filter((x) => x !== t) : [...prefs.tabs, t])
  const [cat, setCat] = useState<(typeof CATS)[number]>('Interfaz')
  if (!prefsOpen) return null
  return (
    <div className="modal-backdrop" onClick={closePrefs}>
      <div className="modal prefs" onClick={(e) => e.stopPropagation()}>
        <div className="row"><h1>{t('Preferencias')}</h1><span className="grow" /><button className="ghost mini" onClick={closePrefs}>{t('Cerrar')}</button></div>
        <div className="prefs-body">
          <ul className="prefs-cats">
            {CATS.map((c) => <li key={c} className={c === cat ? 'active' : ''} onClick={() => setCat(c)}>{t(c)}</li>)}
          </ul>
          <div className="prefs-panel scroll">
            {cat === 'Interfaz' && (
              <>
                <h2>{t('Color de acento')}</h2>
                <div className="swatches">
                  {(Object.keys(ACCENTS) as AccentName[]).map((a) => (
                    <button key={a} className={`swatch ${prefs.accent === a ? 'on' : ''}`} title={t(ACCENT_LABEL[a])} onClick={() => setPref('accent', a)} style={{ background: ACCENTS[a][0] }} aria-label={t(ACCENT_LABEL[a])} />
                  ))}
                </div>
                <h2>{t('Tamaño de la interfaz')}</h2>
                <div className="segmented">
                  {SCALES.map(([s, l]) => (
                    <button key={s} className={prefs.scale === s ? 'on' : 'ghost'} onClick={() => setPref('scale', s)}>{t(l)}</button>
                  ))}
                </div>
                <p className="muted tiny">{t('Ajusta el tamaño de todo el texto e interfaz. Se guarda en este equipo.')}</p>
                <h2>{t('Vista por rol (pestañas)')}</h2>
                <div className="segmented">
                  {ROLE_PRESETS.map(([label, tabs]) => (
                    <button key={label} className={prefs.tabs.join() === tabs.join() ? 'on' : 'ghost'} onClick={() => setTabs(tabs)}>{t(label)}</button>
                  ))}
                </div>
                <div className="row" style={{ flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
                  {Object.entries(TAB_LABEL).map(([tb, l]) => (
                    <label key={tb} className="check"><input type="checkbox" checked={prefs.tabs.includes(tb)} onChange={() => toggleTab(tb)} /> {t(l)}</label>
                  ))}
                </div>
                <p className="muted tiny">{t('Muestra solo las pestañas que necesitas. Ajustes siempre está visible.')}</p>

                <h2>{t('Disposición')}</h2>
                <button className="ghost" onClick={resetLayout}>{t('Restablecer paneles')}</button>
                <p className="muted tiny">{t('En el Escritorio puedes arrastrar los bordes entre paneles para redimensionarlos, y arrastrar las cabeceras de la biblioteca (Episodios, Personajes…) para reordenarlas o plegarlas. Esto las devuelve a su lugar.')}</p>
              </>
            )}
            {cat === 'Editor' && (
              <>
                <h2>{t('Guión')}</h2>
                <label className="check"><input type="checkbox" checked={showTags} onChange={toggleTags} /> {t('Mostrar etiquetas de elemento (HEADING, ACTION, DIALOGUE…) en el margen')}</label>
                <p className="muted tiny">{t('Las etiquetas ayudan a leer la estructura Fountain. Puedes alternarlas también con el botón ABC de la barra de scope.')}</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
