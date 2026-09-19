import { useState } from 'react'
import { ACCENTS, useStore, type AccentName, type Scale } from '../store'

// Preferencias de interfaz (estilo suite Adobe): categorías a la izquierda, ajustes a la derecha.
// Solo tocan la apariencia local; la configuración del proyecto vive en la pestaña Ajustes.
const ACCENT_LABEL: Record<AccentName, string> = { naranja: 'Naranja', ambar: 'Ámbar', azul: 'Azul', verde: 'Verde', rosa: 'Rosa' }
const SCALES: [Scale, string][] = [['compact', 'Compacta'], ['normal', 'Normal'], ['large', 'Grande']]
const CATS = ['Interfaz', 'Editor'] as const

export function Preferences() {
  const { prefsOpen, closePrefs, prefs, setPref, showTags, toggleTags, resetLayout } = useStore()
  const [cat, setCat] = useState<(typeof CATS)[number]>('Interfaz')
  if (!prefsOpen) return null
  return (
    <div className="modal-backdrop" onClick={closePrefs}>
      <div className="modal prefs" onClick={(e) => e.stopPropagation()}>
        <div className="row"><h1>Preferencias</h1><span className="grow" /><button className="ghost mini" onClick={closePrefs}>Cerrar</button></div>
        <div className="prefs-body">
          <ul className="prefs-cats">
            {CATS.map((c) => <li key={c} className={c === cat ? 'active' : ''} onClick={() => setCat(c)}>{c}</li>)}
          </ul>
          <div className="prefs-panel scroll">
            {cat === 'Interfaz' && (
              <>
                <h2>Color de acento</h2>
                <div className="swatches">
                  {(Object.keys(ACCENTS) as AccentName[]).map((a) => (
                    <button key={a} className={`swatch ${prefs.accent === a ? 'on' : ''}`} title={ACCENT_LABEL[a]} onClick={() => setPref('accent', a)} style={{ background: ACCENTS[a][0] }} aria-label={ACCENT_LABEL[a]} />
                  ))}
                </div>
                <h2>Tamaño de la interfaz</h2>
                <div className="segmented">
                  {SCALES.map(([s, l]) => (
                    <button key={s} className={prefs.scale === s ? 'on' : 'ghost'} onClick={() => setPref('scale', s)}>{l}</button>
                  ))}
                </div>
                <p className="muted tiny">Ajusta el tamaño de todo el texto e interfaz. Se guarda en este equipo.</p>
                <h2>Disposición</h2>
                <button className="ghost" onClick={resetLayout}>Restablecer paneles</button>
                <p className="muted tiny">En el Escritorio puedes arrastrar los bordes entre paneles para redimensionarlos, y arrastrar las cabeceras de la biblioteca (Episodios, Personajes…) para reordenarlas o plegarlas. Esto las devuelve a su lugar.</p>
              </>
            )}
            {cat === 'Editor' && (
              <>
                <h2>Guión</h2>
                <label className="check"><input type="checkbox" checked={showTags} onChange={toggleTags} /> Mostrar etiquetas de elemento (HEADING, ACTION, DIALOGUE…) en el margen</label>
                <p className="muted tiny">Las etiquetas ayudan a leer la estructura Fountain. Puedes alternarlas también con el botón ABC de la barra de scope.</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
