import type { SceneRef } from '../../../core/planning'
import { t } from '../../i18n'
import { useStore } from '../../store'
import type { ScriptInfo } from './data'

// Selector de escena {guion, encabezado}: base de las referencias cruzadas (preguntas, plants, ideas).
export function SceneRefPicker({ value, onChange, scripts, allowNone = true }: { value: SceneRef | undefined; onChange: (r: SceneRef | undefined) => void; scripts: ScriptInfo[]; allowNone?: boolean }) {
  const script = scripts.find((s) => s.path === value?.script) ?? (value ? undefined : scripts[0])
  return (
    <span className="refpick">
      {scripts.length > 1 && (
        <select value={value?.script ?? ''} onChange={(e) => { const s = scripts.find((x) => x.path === e.target.value); onChange(s ? { script: s.path, heading: s.scenes[0]?.heading ?? '' } : undefined) }}>
          {allowNone && <option value="">—</option>}
          {scripts.map((s) => <option key={s.path} value={s.path}>{s.name}</option>)}
        </select>
      )}
      <select value={value?.heading ?? ''} onChange={(e) => onChange(e.target.value ? { script: (script ?? scripts[0])!.path, heading: e.target.value } : undefined)}>
        {allowNone && <option value="">{t('— escena —')}</option>}
        {(script ?? scripts[0])?.scenes.map((sc, i) => <option key={i} value={sc.heading}>#{i + 1} {sc.heading.slice(0, 40)}</option>)}
      </select>
    </span>
  )
}

// Salta a la escena referenciada en el Escritorio.
export function useOpenScene() {
  const { openFile, setTab } = useStore()
  return (scripts: ScriptInfo[], r: SceneRef | undefined) => {
    if (!r) return
    const s = scripts.find((x) => x.path === r.script)
    const sc = s?.scenes.find((x) => x.heading.trim().toUpperCase() === r.heading.trim().toUpperCase())
    if (s) { void openFile(s.path, sc?.startLine); setTab('desk') }
  }
}

// Chips de personajes con toggle.
export function CharChips({ all, value, onChange }: { all: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="chips">
      {all.map((n) => <button key={n} className={value.includes(n) ? 'mini on' : 'mini ghost'} onClick={() => onChange(value.includes(n) ? value.filter((x) => x !== n) : [...value, n])}>{n}</button>)}
    </div>
  )
}

export const SEV_LABEL: Record<string, string> = { info: 'Información', review: 'Vale revisar', inconsistency: 'Posible inconsistencia', incomplete: 'Dato incompleto' }
export const SEV_COLOR: Record<string, string> = { info: '#8b91a0', review: '#c47d1a', inconsistency: '#e8437f', incomplete: '#4f8cff' }
