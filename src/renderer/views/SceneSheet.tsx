import { PRESENCE, SCENE_FIELDS, SCENE_STATUS, SCENE_STATUS_ES, type Presence, type SceneMeta } from '../../core/planning'
import { t } from '../i18n'
import { BlurInput } from '../ui'

// Ficha de escena compartida por el Escritorio y el Beat Timeline (ScriptWriterX §12):
// número de industria, OMITIDA, estado, POV, presencia por entidad y campos narrativos.
export function SceneSheet({ meta, index, chars, tracks = [], onChange }: {
  meta: SceneMeta
  index: number
  chars: string[]
  tracks?: { id: string; name: string }[]
  onChange: (patch: Partial<SceneMeta>) => void
}) {
  const setPresence = (c: string) => {
    const cur = meta.presencia?.[c]
    const next: Presence | undefined = cur === 'habla' ? 'presente' : cur === 'presente' ? 'mencion' : cur === 'mencion' ? undefined : 'habla'
    const map: Record<string, Presence> = { ...(meta.presencia ?? {}) }
    if (next) map[c] = next
    else delete map[c]
    onChange({ presencia: Object.keys(map).length ? map : undefined })
  }
  return (
    <>
      <div className="row tiny">
        <label className="field"><span>{t('Número')}</span><BlurInput value={meta.numero ?? String(index + 1)} onCommit={(v) => onChange({ numero: v.trim() || undefined })} /></label>
        <label className="row tiny" title={t('La escena conserva su número pero no se rueda')}><input type="checkbox" checked={meta.omitida === true} onChange={(e) => onChange({ omitida: e.target.checked || undefined })} />{t('Omitida')}</label>
      </div>
      <div className="row tiny">
        <label className="field grow"><span>{t('Estado')}</span>
          <select value={meta.status ?? ''} onChange={(e) => onChange({ status: (e.target.value || undefined) as SceneMeta['status'] })}>
            <option value="">—</option>
            {SCENE_STATUS.map((st) => <option key={st} value={st}>{t(SCENE_STATUS_ES[st])}</option>)}
          </select>
        </label>
        <label className="field grow"><span>POV</span>
          <select value={meta.pov ?? ''} onChange={(e) => onChange({ pov: e.target.value || undefined })}>
            <option value="">—</option>
            {chars.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        {tracks.length > 0 && (
          <label className="field grow"><span>Track</span>
            <select value={meta.track ?? ''} onChange={(e) => onChange({ track: e.target.value || undefined })}>
              <option value="">—</option>
              {tracks.map((tr) => <option key={tr.id} value={tr.id}>{tr.name}</option>)}
            </select>
          </label>
        )}
      </div>
      <div className="field"><span>{t('Presencia')}</span>
        <div className="chips">
          {chars.slice(0, 16).map((c) => {
            const cur = meta.presencia?.[c]
            const label = PRESENCE.find(([k]) => k === cur)?.[1]
            return (
              <button key={c} className={cur ? 'mini on' : 'mini ghost'} title={`${c}: ${label ? t(label) : t('sin marcar')}`} onClick={() => setPresence(c)}>
                <span className="ell">{c}</span>{label ? ` · ${t(label)}` : ''}
              </button>
            )
          })}
        </div>
      </div>
      {SCENE_FIELDS.map(([k, label, hint]) => (
        <label className="field" key={k}><span>{t(label)}</span>
          <BlurInput textarea={k !== 'summary'} rows={2} value={String(meta[k] ?? '')} placeholder={t(hint)} onCommit={(v) => onChange({ [k]: v })} />
        </label>
      ))}
    </>
  )
}
