import { useEffect, useRef, useState } from 'react'
import { Adoption } from './views/Adoption'
import { Analysis } from './views/Analysis'
import { BeatTimeline } from './views/BeatTimeline'
import { Preferences } from './views/Preferences'
import { SearchReplace } from './views/SearchReplace'
import { Rename } from './views/Rename'
import { DevDocs } from './views/DevDocs'
import { Breakdown } from './views/Breakdown'
import { Characters } from './views/Characters'
import { Desk, NewFile } from './views/Desk'
import { NeuralMap } from './views/NeuralMap'
import { Production } from './views/Production'
import { Settings } from './views/Settings'
import { Dashboard } from './views/plan/Dashboard'
import { Planner } from './views/plan/Planner'
import { Questions } from './views/plan/Questions'
import { Plants } from './views/plan/Plants'
import { Ideas } from './views/plan/Ideas'
import { Clinic } from './views/plan/Clinic'
import { Index } from './views/plan/Index'
import { Library } from './views/plan/Library'
import { Palette } from './views/Palette'
import { QuickNote } from './views/QuickNote'
import { exportProjectJson, importProjectJson } from './portable'
import { PLANNING_PATH, readPlanning } from '../core/planning'
import { Icon } from './ui'
import { estimateTokens } from '../core/safeguards'
import { COMMANDS, QUICK_ADD, label, runCommand } from './commands'
import { getLang, t } from './i18n'
import { useStore, type DevTab, type PlanTab, type Tab } from './store'
import type { FileKind } from '../core/types/ipc'

const TABS: [Tab, string][] = [['desk', 'Escritorio'], ['breakdown', 'Breakdown'], ['dev', 'Desarrollo'], ['plan', 'Planificación'], ['production', 'Producción'], ['settings', 'Ajustes']]
const DEV: [DevTab, string][] = [['characters', 'Personajes'], ['beats', 'Beat Timeline'], ['map', 'Mapa neural'], ['analysis', 'Análisis'], ['docs', 'Documentos']]
const PLAN: [PlanTab, string][] = [['dashboard', 'Dashboard'], ['planner', 'Planner'], ['questions', 'Preguntas'], ['plants', 'Plant & Payoff'], ['ideas', 'Ideas'], ['clinic', 'Clinic'], ['index', 'Index'], ['library', 'Biblioteca']]

// Menú desplegable de la barra superior (estilo suite Adobe).
function AppMenu() {
  const { openVault, openPrefs, setTab, openLinker, openSearch, setLanguage, vault, recents, openVaultPath, setQuickNoteOpen, setPaletteOpen } = useStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const lang = getLang()
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])
  const item = (label: string, fn: () => void) => (
    <button className="menu-item" onClick={() => { setOpen(false); fn() }}>{label}</button>
  )
  return (
    <div className="appmenu" ref={ref}>
      <button className="ghost" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{t('☰ Menú')}</button>
      {open && (
        <div className="menu" role="menu">
          {item(t('Preferencias…'), openPrefs)}
          {vault && item(t('Buscar y reemplazar…'), openSearch)}
          {item(t('Abrir vault…'), () => void openVault())}
          {recents.filter((r) => r !== vault?.root).length > 0 && (
            <>
              <div className="menu-label">{t('Recientes')}</div>
              {recents.filter((r) => r !== vault?.root).slice(0, 5).map((r) => <button key={r} className="menu-item ell" title={r} onClick={() => { setOpen(false); void openVaultPath(r) }}>{r.split(/[\\/]/).pop()}</button>)}
            </>
          )}
          {vault && item(t('Vincular carpetas…'), openLinker)}
          {item(t('Ajustes del proyecto'), () => setTab('settings'))}
          <div className="menu-sep" />
          {vault && item(t('Buscar en todo…') + '  Ctrl+K', () => setPaletteOpen(true))}
          {vault && item(t('Nota rápida…') + '  Ctrl+Shift+N', () => setQuickNoteOpen(true))}
          {vault && item(t('Exportar proyecto (JSON)'), () => void exportProjectJson())}
          {vault && item(t('Importar proyecto (JSON)'), () => void importProjectJson())}
          <div className="menu-sep" />
          <div className="menu-label">{t('Idioma')}</div>
          <button className={`menu-item ${lang === 'en' ? 'sel' : ''}`} onClick={() => setLanguage('en')}><span className="chk">{lang === 'en' && <Icon name="check" size={12} />}</span>{t('Inglés')}</button>
          <button className={`menu-item ${lang === 'es' ? 'sel' : ''}`} onClick={() => setLanguage('es')}><span className="chk">{lang === 'es' && <Icon name="check" size={12} />}</span>{t('Español')}</button>
          <div className="menu-sep" />
          {item(t('Recargar'), () => location.reload())}
        </div>
      )}
    </div>
  )
}

// Botón "+" de la cabecera (Quick Add): crear cualquier cosa desde cualquier vista.
function QuickAdd() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])
  return (
    <div className="appmenu" ref={ref}>
      <button className="ghost" title={t('Nuevo…')} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}><Icon name="plus" size={14} />{t('Nuevo')}</button>
      {open && (
        <div className="menu" role="menu">
          {QUICK_ADD.map((id, i) => id === 'sep' ? <div key={i} className="menu-sep" /> : (
            <button key={id} className="menu-item" onClick={() => { setOpen(false); runCommand(id) }}>{label(id)}<span className="grow" />{COMMANDS[id]?.shortcut && <span className="muted tiny">{COMMANDS[id]!.shortcut}</span>}</button>
          ))}
        </div>
      )}
    </div>
  )
}

// Modal "Nuevo…" (menú Historia / botón +): reutiliza el alta del Escritorio y salta a la vista del tipo creado.
const AFTER_NEW: Record<Exclude<FileKind, 'other'>, () => void> = {
  script: () => useStore.getState().setTab('desk'),
  character: () => { useStore.getState().setTab('dev'); useStore.getState().setDevTab('characters') },
  location: () => useStore.getState().setTab('breakdown'),
  prop: () => useStore.getState().setTab('breakdown'),
  outline: () => useStore.getState().setTab('desk'),
  knowledge: () => useStore.getState().setTab('desk')
}
const NEW_TITLE: Record<Exclude<FileKind, 'other'>, string> = { script: 'Nuevo episodio', character: 'Nuevo personaje', location: 'Nueva locación', prop: 'Nuevo ítem', outline: 'Nueva escaleta', knowledge: 'Nuevo documento de conocimiento' }
function NewEntity() {
  const { newEntity, setNewEntity, vault } = useStore()
  if (!newEntity || !vault) return null
  return (
    <div className="modal-backdrop" onClick={() => setNewEntity(null)}>
      <div className="modal" style={{ width: 'min(460px, 92vw)' }} onClick={(e) => e.stopPropagation()}>
        <div className="row"><h1>{t(NEW_TITLE[newEntity])}</h1><span className="grow" /><button className="mini ghost" onClick={() => setNewEntity(null)}>{t('Cerrar')}</button></div>
        <p className="muted tiny">{t('Se crea en')} {vault.config.roles[newEntity]?.[0] ?? newEntity}/</p>
        <NewFile kind={newEntity} onDone={(created) => { setNewEntity(null); if (created) AFTER_NEW[newEntity]() }} />
      </div>
    </div>
  )
}

// Ayuda → Atajos de teclado.
const EXTRA_SHORTCUTS: [string, string][] = [['Escape', 'Cierra el modal abierto'], ['Ctrl+Enter', 'Guarda la nota rápida'], ['Ctrl+clic en [[Nombre]]', 'Abre la ficha de la entidad'], ['Ctrl+S', 'Guarda el archivo abierto']]
function Shortcuts() {
  const { shortcutsOpen, setShortcutsOpen } = useStore()
  if (!shortcutsOpen) return null
  const rows = Object.entries(COMMANDS).filter(([, c]) => c.shortcut).map(([id, c]) => [c.shortcut!, label(id)] as [string, string])
  return (
    <div className="modal-backdrop" onClick={() => setShortcutsOpen(false)}>
      <div className="modal" style={{ width: 'min(560px, 92vw)' }} onClick={(e) => e.stopPropagation()}>
        <div className="row"><h1>{t('Atajos de teclado')}</h1><span className="grow" /><button className="mini ghost" onClick={() => setShortcutsOpen(false)}>{t('Cerrar')}</button></div>
        <table className="table"><tbody>
          {[...rows, ...EXTRA_SHORTCUTS.map(([k, l]) => [k, t(l)] as [string, string])].map(([k, l]) => <tr key={k + l}><td><kbd>{k}</kbd></td><td>{l}</td></tr>)}
        </tbody></table>
      </div>
    </div>
  )
}

function Pomodoro() {
  const { pomo, pomoToggle, pomoReset, pomoSkip } = useStore()
  const mm = String(Math.floor(pomo.left / 60)).padStart(2, '0'), ss = String(pomo.left % 60).padStart(2, '0')
  const label = pomo.mode === 'focus' ? t('Foco') : pomo.mode === 'short' ? t('Descanso') : t('Descanso largo')
  return (
    <span className={`pomo ${pomo.running ? 'on' : ''} ${pomo.mode}`} title={`${label} · ${t('clic: iniciar/pausar · doble clic: reiniciar')}`}>
      <button className="mini ghost" onClick={pomoToggle} onDoubleClick={() => pomoReset()}><Icon name="timer" size={12} />{mm}:{ss}</button>
      {pomo.running && <button className="mini ghost" title={t('Saltar')} onClick={pomoSkip}>»</button>}
      {pomo.done > 0 && <span className="muted tiny">{'●'.repeat(Math.min(4, pomo.done % 4 || 4))}</span>}
    </span>
  )
}

export function App() {
  const s = useStore()
  const provider = s.vault?.config.byok.provider ?? 'anthropic'
  const goal = readPlanning(s.docs.find((d) => d.path === PLANNING_PATH)?.content).goal
  const totalWords = s.docs.filter((d) => s.files.some((f) => f.path === d.path && f.kind === 'script')).reduce((a, d) => a + d.content.replace(/^---[\s\S]*?---/, '').split(/\s+/).filter(Boolean).length, 0)
  // Atajos globales: Ctrl+K paleta, Ctrl+Shift+N nota rápida.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const st = useStore.getState()
      if (e.key === 'Escape') { // cierra el modal abierto (Escape dentro de un input ya lo gestiona cada vista)
        if (st.paletteOpen) st.setPaletteOpen(false)
        else if (st.quickNoteOpen) st.setQuickNoteOpen(false)
        else if (st.newEntity) st.setNewEntity(null)
        else if (st.shortcutsOpen) st.setShortcutsOpen(false)
        else if (st.prefsOpen) st.closePrefs()
        else if (st.searchOpen) st.closeSearch()
        else if (st.rename) st.closeRename()
        else if (st.linker && st.vault) st.cancelLink()
        return
      }
      if (!st.vault || st.paletteOpen || st.quickNoteOpen || st.prefsOpen || st.searchOpen || st.rename || st.linker || st.newEntity || st.shortcutsOpen) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); st.setPaletteOpen(true) }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'n') { e.preventDefault(); st.setQuickNoteOpen(true) }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])
  // Menú nativo: ejecuta sus comandos y le manda idioma, recientes y estado de los conmutadores de Ver.
  useEffect(() => { window.api.onMenu((id) => (id.startsWith('openPath:') ? void useStore.getState().openVaultPath(id.slice(9)) : runCommand(id))) }, [])
  useEffect(() => { window.api.menuSetup({ lang: getLang(), recents: s.recents, focus: s.prefs.focus, page: s.prefs.page, tags: s.showTags }) }, [s.recents, s.prefs.focus, s.prefs.page, s.showTags])
  const scene = s.path ? s.projection.scenes.find((sc) => s.cursorLine >= sc.startLine && s.cursorLine < sc.endLine) : undefined
  const sceneText = scene ? s.text.split('\n').slice(scene.startLine, scene.endLine).join('\n') : ''
  return (
    <>
      <header>
        <strong>Writter</strong>
        <nav>
          {TABS.filter(([t]) => t === 'settings' || s.prefs.tabs.includes(t)).map(([tb, l]) => (
            <button key={tb} className={s.tab === tb ? 'on' : 'ghost'} disabled={!s.vault && tb !== 'desk'} onClick={() => s.setTab(tb)}>{t(l)}</button>
          ))}
        </nav>
        {s.tab === 'dev' && (
          <nav className="sub">
            {DEV.map(([tb, l]) => (
              <button key={tb} className={s.devTab === tb ? 'on' : 'ghost'} onClick={() => s.setDevTab(tb)}>{t(l)}</button>
            ))}
          </nav>
        )}
        {s.tab === 'plan' && (
          <nav className="sub">
            {PLAN.map(([tb, l]) => (
              <button key={tb} className={s.planTab === tb ? 'on' : 'ghost'} onClick={() => s.setPlanTab(tb)}>{t(l)}</button>
            ))}
          </nav>
        )}
        <span className="grow" />
        <span className="muted crumb">{s.vault ? s.vault.root.split(/[\\/]/).pop() : t('Sin proyecto')}</span>
        {s.graph && <span className="pill" title={s.graph.reason}>{t('índice')} {s.graph.stale ? t('reindexando') : t('al día')}</span>}
        {s.vault && <QuickAdd />}
        {s.vault && <Pomodoro />}
        <button className="ghost" onClick={() => void s.openVault()}>{t('Abrir vault')}</button>
        <AppMenu />
      </header>
      {s.tab === 'desk' && <Desk />}
      {s.tab === 'breakdown' && <Breakdown />}
      {s.tab === 'dev' && s.devTab === 'characters' && <Characters />}
      {s.tab === 'dev' && s.devTab === 'beats' && <BeatTimeline />}
      {s.tab === 'dev' && s.devTab === 'map' && <NeuralMap />}
      {s.tab === 'dev' && s.devTab === 'analysis' && <Analysis />}
      {s.tab === 'dev' && s.devTab === 'docs' && <DevDocs />}
      {s.tab === 'plan' && s.planTab === 'dashboard' && <Dashboard />}
      {s.tab === 'plan' && s.planTab === 'planner' && <Planner />}
      {s.tab === 'plan' && s.planTab === 'questions' && <Questions />}
      {s.tab === 'plan' && s.planTab === 'plants' && <Plants />}
      {s.tab === 'plan' && s.planTab === 'ideas' && <Ideas />}
      {s.tab === 'plan' && s.planTab === 'clinic' && <Clinic />}
      {s.tab === 'plan' && s.planTab === 'index' && <Index />}
      {s.tab === 'plan' && s.planTab === 'library' && <Library />}
      {s.tab === 'production' && <Production />}
      {s.tab === 'settings' && <Settings />}
      <Adoption />
      <Preferences />
      <SearchReplace />
      <Rename />
      <Palette />
      <QuickNote />
      <NewEntity />
      <Shortcuts />
      <footer>
        <span>{s.status ? t(s.status) : '—'}</span>
        <span className="grow" />
        {scene && <span className="muted">{t('Escena')} {scene.index + 1}: {scene.wordCount} {t('pal')} · ≈{estimateTokens(sceneText)} {t('tok')} · {t('pág')} {s.pagination.lineToPage[scene.startLine] ?? 1}</span>}
        {s.path && <span>{t('Guion')}: {s.projection.wordCount} {t('pal')} · ≈{estimateTokens(s.text)} {t('tok')} · {s.pagination.pages} {t('pág.')}</span>}
        {goal > 0 && <span className="goal" title={`${totalWords.toLocaleString()} / ${goal.toLocaleString()} ${t('palabras')}`}>{t('Meta')} {Math.min(100, Math.round((totalWords / goal) * 100))}% <span className="goalbar"><span style={{ width: `${Math.min(100, (totalWords / goal) * 100)}%` }} /></span></span>}
        <span>BYOK: {provider} {s.keyStatus?.present || provider === 'ollama' ? '●' : '○'}</span>
      </footer>
    </>
  )
}
