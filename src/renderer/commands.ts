// Tabla única de comandos: la usan el menú nativo (ids enviados desde main), el botón "+" de la cabecera
// y los comandos ">" de la paleta. Etiquetas en español pasadas por t() al mostrarse.
import type { FileKind } from '../core/types/ipc'
import { t } from './i18n'
import { exportProjectJson, importProjectJson } from './portable'
import { useStore, type DevTab, type PlanTab } from './store'

export type Command = { label: string; shortcut?: string; run: () => void; free?: boolean /* utilizable sin vault */ }

const S = () => useStore.getState()
const focusNew = () => setTimeout(() => document.querySelector<HTMLInputElement>('[data-new]')?.focus(), 80)
const goPlan = (p: PlanTab) => { S().setTab('plan'); S().setPlanTab(p) }
const goDev = (d: DevTab) => { S().setTab('dev'); S().setDevTab(d) }
const newFile = (k: Exclude<FileKind, 'other'>) => S().setNewEntity(k)

export const COMMANDS: Record<string, Command> = {
  'file.newScript': { label: 'Nuevo episodio…', shortcut: 'Ctrl+N', run: () => newFile('script') },
  'file.newCharacter': { label: 'Nuevo personaje…', run: () => newFile('character') },
  'file.newLocation': { label: 'Nueva locación…', run: () => newFile('location') },
  'file.newProp': { label: 'Nuevo ítem…', run: () => newFile('prop') },
  'file.newKnowledge': { label: 'Nuevo documento de conocimiento…', run: () => newFile('knowledge') },
  'file.quickNote': { label: 'Nueva nota rápida…', shortcut: 'Ctrl+Shift+N', run: () => S().setQuickNoteOpen(true) },
  'file.openVault': { label: 'Abrir vault…', shortcut: 'Ctrl+O', free: true, run: () => void S().openVault() },
  'file.link': { label: 'Vincular carpetas…', run: () => S().openLinker() },
  'file.importScript': { label: 'Importar .fountain / .fdx…', run: () => void window.api.importScript().then((f) => f && S().refreshFiles().then(() => { void S().openFile(f.path); S().setTab('desk') })) },
  'file.importJson': { label: 'Importar proyecto (JSON)…', run: () => void importProjectJson() },
  'file.exportCurrent': { label: 'Exportar episodio actual…', run: () => { S().setTab('desk'); S().setDeskPanel('export') } },
  'file.exportJson': { label: 'Exportar proyecto (JSON)…', run: () => void exportProjectJson() },
  'file.projectSettings': { label: 'Ajustes del proyecto', run: () => S().setTab('settings') },
  'file.prefs': { label: 'Preferencias…', shortcut: 'Ctrl+,', free: true, run: () => S().openPrefs() },

  'edit.searchReplace': { label: 'Buscar y reemplazar…', shortcut: 'Ctrl+H', run: () => S().openSearch() },
  'edit.searchAll': { label: 'Buscar en todo…', shortcut: 'Ctrl+K', run: () => S().setPaletteOpen(true) },

  'view.desk': { label: 'Escritorio', shortcut: 'Ctrl+1', run: () => S().setTab('desk') },
  'view.breakdown': { label: 'Breakdown', shortcut: 'Ctrl+2', run: () => S().setTab('breakdown') },
  'view.dev': { label: 'Desarrollo', shortcut: 'Ctrl+3', run: () => S().setTab('dev') },
  'view.plan': { label: 'Planificación', shortcut: 'Ctrl+4', run: () => S().setTab('plan') },
  'view.production': { label: 'Producción', shortcut: 'Ctrl+5', run: () => S().setTab('production') },
  'view.settings': { label: 'Ajustes', shortcut: 'Ctrl+6', run: () => S().setTab('settings') },
  'view.dev.characters': { label: 'Personajes', run: () => goDev('characters') },
  'view.dev.beats': { label: 'Beat Timeline', run: () => goDev('beats') },
  'view.dev.map': { label: 'Mapa neural', run: () => goDev('map') },
  'view.dev.analysis': { label: 'Análisis', run: () => goDev('analysis') },
  'view.dev.docs': { label: 'Documentos', run: () => goDev('docs') },
  'view.plan.dashboard': { label: 'Dashboard', run: () => goPlan('dashboard') },
  'view.plan.planner': { label: 'Planner', run: () => goPlan('planner') },
  'view.plan.questions': { label: 'Preguntas', run: () => goPlan('questions') },
  'view.plan.plants': { label: 'Plant & Payoff', run: () => goPlan('plants') },
  'view.plan.ideas': { label: 'Ideas', run: () => goPlan('ideas') },
  'view.plan.clinic': { label: 'Clinic', run: () => goPlan('clinic') },
  'view.plan.index': { label: 'Index', run: () => goPlan('index') },
  'view.plan.library': { label: 'Biblioteca', run: () => goPlan('library') },
  'view.focus': { label: 'Modo enfoque', run: () => S().setPref('focus', !S().prefs.focus) },
  'view.page': { label: 'Modo página', run: () => S().setPref('page', !S().prefs.page) },
  'view.tags': { label: 'Etiquetas de elemento', run: () => S().toggleTags() },

  'story.newQuestion': { label: 'Nueva pregunta dramática', run: () => { goPlan('questions'); focusNew() } },
  'story.newPlant': { label: 'Nuevo plant', run: () => { goPlan('plants'); focusNew() } },
  'story.newIdea': { label: 'Nueva idea de escena', run: () => { goPlan('ideas'); focusNew() } },
  'story.newTrack': { label: 'Nuevo track', run: () => { goPlan('planner'); focusNew() } },
  'story.applyTemplate': { label: 'Aplicar plantilla…', run: () => { goDev('beats'); setTimeout(() => document.querySelectorAll<HTMLSelectElement>('main.bt select')[1]?.focus(), 80) } },

  'tools.clinic': { label: 'Clinic', run: () => goPlan('clinic') },
  'tools.cmm': { label: 'Matriz de motivación', run: () => goPlan('ideas') },
  'tools.map': { label: 'Mapa neural', run: () => goDev('map') },
  'tools.analysis': { label: 'Análisis', run: () => goDev('analysis') },
  'tools.pomoToggle': { label: 'Pomodoro: iniciar / pausar', free: true, run: () => S().pomoToggle() },
  'tools.pomoReset': { label: 'Reiniciar Pomodoro', free: true, run: () => S().pomoReset() },
  'tools.pomoSkip': { label: 'Saltar fase del Pomodoro', free: true, run: () => S().pomoSkip() },
  'tools.goal': { label: 'Meta de palabras…', run: () => { goPlan('dashboard'); setTimeout(() => document.querySelector<HTMLInputElement>('main input[type=number]')?.focus(), 80) } },
  'tools.reindex': { label: 'Reindexar grafo', run: () => void S().refreshGraph(true) },

  'window.prevTab': { label: 'Pestaña anterior', shortcut: 'Ctrl+Shift+[', free: true, run: () => S().cycleTab(-1) },
  'window.nextTab': { label: 'Pestaña siguiente', shortcut: 'Ctrl+Shift+]', free: true, run: () => S().cycleTab(1) },

  'help.shortcuts': { label: 'Atajos de teclado…', free: true, run: () => S().setShortcutsOpen(true) }
}

// Botón "+" de la cabecera (Quick Add del PRD): qué se puede crear desde cualquier vista.
export const QUICK_ADD = ['file.newScript', 'file.newCharacter', 'file.newLocation', 'file.newProp', 'file.newKnowledge', 'sep', 'story.newQuestion', 'story.newPlant', 'story.newIdea', 'story.newTrack', 'sep', 'file.quickNote'] as const

// Comandos ">" de la paleta: todo menos la navegación pura (que ya cubre la búsqueda normal).
export const PALETTE = Object.keys(COMMANDS).filter((id) => !id.startsWith('view.') || ['view.focus', 'view.page', 'view.tags'].includes(id))

export const label = (id: string): string => t(COMMANDS[id]?.label ?? id)

export function runCommand(id: string): void {
  const c = COMMANDS[id]
  if (!c) return
  if (!c.free && !useStore.getState().vault) { useStore.setState({ status: t('Abre un vault primero.') }); return }
  c.run()
}
