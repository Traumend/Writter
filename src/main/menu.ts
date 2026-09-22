// Menú nativo de la aplicación (PRD §110–118 adaptado a Writter). Bilingüe: el renderer manda su idioma y sus
// vaults recientes (`menu.setup`); cada ítem envía su id al renderer, que lo resuelve en `renderer/commands.ts`.
import { app, BrowserWindow, dialog, Menu, shell, type MenuItemConstructorOptions } from 'electron'

export type MenuSetup = { lang: 'es' | 'en'; recents: string[]; focus?: boolean; page?: boolean; tags?: boolean }

const REPO = 'https://github.com/Traumend/Writter'

export function buildMenu(win: BrowserWindow, setup: MenuSetup): void {
  const es = setup.lang === 'es'
  const L = (a: string, b: string) => (es ? a : b)
  const send = (id: string) => () => win.webContents.send('menu', id)
  const cmd = (id: string, a: string, b: string, accelerator?: string, extra: Partial<MenuItemConstructorOptions> = {}): MenuItemConstructorOptions => ({ label: L(a, b), accelerator, click: send(id), ...extra })
  const sep: MenuItemConstructorOptions = { type: 'separator' }
  const base = (p: string) => p.split(/[\\/]/).pop() ?? p

  const template: MenuItemConstructorOptions[] = [
    {
      label: L('Archivo', 'File'),
      submenu: [
        cmd('file.newScript', 'Nuevo episodio…', 'New episode…', 'CmdOrCtrl+N'),
        cmd('file.newCharacter', 'Nuevo personaje…', 'New character…'),
        cmd('file.quickNote', 'Nueva nota rápida…', 'New quick note…', 'CmdOrCtrl+Shift+N'),
        sep,
        cmd('file.openVault', 'Abrir vault…', 'Open vault…', 'CmdOrCtrl+O'),
        {
          label: L('Recientes', 'Recent'),
          submenu: setup.recents.length
            ? setup.recents.map((r) => ({ label: base(r), toolTip: r, click: () => win.webContents.send('menu.openPath', r) }))
            : [{ label: L('(sin recientes)', '(none)'), enabled: false }]
        },
        cmd('file.link', 'Vincular carpetas…', 'Link folders…'),
        sep,
        { label: L('Importar', 'Import'), submenu: [cmd('file.importScript', 'Guion .fountain / .fdx…', 'Script .fountain / .fdx…'), cmd('file.importJson', 'Proyecto (JSON)…', 'Project (JSON)…')] },
        { label: L('Exportar', 'Export'), submenu: [cmd('file.exportCurrent', 'Episodio actual (PDF, DOCX, FDX, Fountain, TXT)…', 'Current episode (PDF, DOCX, FDX, Fountain, TXT)…'), cmd('file.exportJson', 'Proyecto (JSON)…', 'Project (JSON)…')] },
        sep,
        cmd('file.projectSettings', 'Ajustes del proyecto', 'Project settings'),
        cmd('file.prefs', 'Preferencias…', 'Preferences…', 'CmdOrCtrl+,'),
        sep,
        { role: 'quit', label: L('Salir', 'Quit') }
      ]
    },
    {
      label: L('Edición', 'Edit'),
      submenu: [
        { role: 'undo', label: L('Deshacer', 'Undo') },
        { role: 'redo', label: L('Rehacer', 'Redo') },
        sep,
        { role: 'cut', label: L('Cortar', 'Cut') },
        { role: 'copy', label: L('Copiar', 'Copy') },
        { role: 'paste', label: L('Pegar', 'Paste') },
        { role: 'selectAll', label: L('Seleccionar todo', 'Select all') },
        sep,
        cmd('edit.searchReplace', 'Buscar y reemplazar…', 'Find and replace…', 'CmdOrCtrl+H'),
        cmd('edit.searchAll', 'Buscar en todo…', 'Search everything…', 'CmdOrCtrl+K')
      ]
    },
    {
      label: L('Ver', 'View'),
      submenu: [
        cmd('view.desk', 'Escritorio', 'Writing Desk', 'CmdOrCtrl+1'),
        cmd('view.breakdown', 'Breakdown', 'Breakdown', 'CmdOrCtrl+2'),
        cmd('view.dev', 'Desarrollo', 'Development', 'CmdOrCtrl+3'),
        cmd('view.plan', 'Planificación', 'Planning', 'CmdOrCtrl+4'),
        cmd('view.production', 'Producción', 'Production', 'CmdOrCtrl+5'),
        cmd('view.settings', 'Ajustes', 'Settings', 'CmdOrCtrl+6'),
        sep,
        { label: L('Desarrollo', 'Development'), submenu: [cmd('view.dev.characters', 'Personajes', 'Characters'), cmd('view.dev.beats', 'Beat Timeline', 'Beat Timeline'), cmd('view.dev.map', 'Mapa neural', 'Neural Map'), cmd('view.dev.analysis', 'Análisis', 'Analysis'), cmd('view.dev.docs', 'Documentos', 'Documents')] },
        { label: L('Planificación', 'Planning'), submenu: [cmd('view.plan.dashboard', 'Dashboard', 'Dashboard'), cmd('view.plan.planner', 'Planner', 'Planner'), cmd('view.plan.questions', 'Preguntas', 'Questions'), cmd('view.plan.plants', 'Plant & Payoff', 'Plant & Payoff'), cmd('view.plan.ideas', 'Ideas', 'Ideas'), cmd('view.plan.clinic', 'Clinic', 'Clinic'), cmd('view.plan.index', 'Index', 'Index'), cmd('view.plan.library', 'Biblioteca', 'Library')] },
        sep,
        cmd('view.focus', 'Modo enfoque', 'Focus mode', undefined, { type: 'checkbox', checked: !!setup.focus }),
        cmd('view.page', 'Modo página', 'Page mode', undefined, { type: 'checkbox', checked: !!setup.page }),
        cmd('view.tags', 'Etiquetas de elemento', 'Element tags', undefined, { type: 'checkbox', checked: !!setup.tags }),
        sep,
        { role: 'zoomIn', label: L('Ampliar', 'Zoom in') },
        { role: 'zoomOut', label: L('Reducir', 'Zoom out') },
        { role: 'resetZoom', label: L('Tamaño real', 'Actual size') },
        { role: 'togglefullscreen', label: L('Pantalla completa', 'Full screen') },
        sep,
        { role: 'reload', label: L('Recargar', 'Reload') },
        { role: 'toggleDevTools', label: L('Herramientas de desarrollo', 'Developer tools') }
      ]
    },
    {
      label: L('Historia', 'Story'),
      submenu: [
        cmd('file.newScript', 'Nuevo episodio…', 'New episode…'),
        cmd('file.newCharacter', 'Nuevo personaje…', 'New character…'),
        cmd('file.newLocation', 'Nueva locación…', 'New location…'),
        cmd('file.newProp', 'Nuevo ítem…', 'New item…'),
        cmd('file.newKnowledge', 'Nuevo documento de conocimiento…', 'New knowledge document…'),
        sep,
        cmd('story.newQuestion', 'Nueva pregunta dramática', 'New story question'),
        cmd('story.newPlant', 'Nuevo plant', 'New plant'),
        cmd('story.newIdea', 'Nueva idea de escena', 'New scene idea'),
        cmd('story.newTrack', 'Nuevo track', 'New track'),
        sep,
        cmd('story.applyTemplate', 'Aplicar plantilla…', 'Apply template…')
      ]
    },
    {
      label: L('Herramientas', 'Tools'),
      submenu: [
        cmd('tools.clinic', 'Clinic', 'Clinic'),
        cmd('tools.cmm', 'Matriz de motivación', 'Motivation matrix'),
        cmd('tools.map', 'Mapa neural', 'Neural Map'),
        cmd('tools.analysis', 'Análisis', 'Analysis'),
        sep,
        cmd('edit.searchAll', 'Buscar en todo…', 'Search everything…'),
        sep,
        cmd('tools.pomoToggle', 'Pomodoro: iniciar / pausar', 'Pomodoro: start / pause'),
        cmd('tools.pomoReset', 'Reiniciar Pomodoro', 'Reset Pomodoro'),
        cmd('tools.pomoSkip', 'Saltar fase del Pomodoro', 'Skip Pomodoro phase'),
        sep,
        cmd('tools.goal', 'Meta de palabras…', 'Word goal…'),
        cmd('tools.reindex', 'Reindexar grafo', 'Reindex graph')
      ]
    },
    {
      label: L('Ventana', 'Window'),
      submenu: [
        { role: 'minimize', label: L('Minimizar', 'Minimize') },
        { role: 'zoom', label: L('Zoom', 'Zoom') },
        sep,
        cmd('window.prevTab', 'Pestaña anterior', 'Previous tab', 'CmdOrCtrl+Shift+['),
        cmd('window.nextTab', 'Pestaña siguiente', 'Next tab', 'CmdOrCtrl+Shift+]'),
        sep,
        { role: 'close', label: L('Cerrar', 'Close') }
      ]
    },
    {
      label: L('Ayuda', 'Help'),
      submenu: [
        { label: L('Primeros pasos', 'Getting started'), click: () => void shell.openExternal(`${REPO}#uso`) },
        { label: L('Documentación', 'Documentation'), click: () => void shell.openExternal(`${REPO}/tree/main/docs`) },
        cmd('help.shortcuts', 'Atajos de teclado…', 'Keyboard shortcuts…'),
        sep,
        { label: L('Reportar un problema', 'Report a problem'), click: () => void shell.openExternal(`${REPO}/issues/new`) },
        sep,
        {
          label: L('Acerca de Writter', 'About Writter'),
          click: () => void dialog.showMessageBox(win, {
            type: 'info',
            title: 'Writter',
            message: `Writter ${app.getVersion()}`,
            detail: L('Plataforma de desarrollo narrativo y preproducción. Local-first: tu vault de archivos .md es la única fuente de verdad; la IA usa tus propias claves y nunca escribe sin tu aceptación.',
              'Narrative development and pre-production platform. Local-first: your vault of .md files is the single source of truth; AI uses your own keys and never writes without your acceptance.')
          })
        }
      ]
    }
  ]
  if (process.platform === 'darwin') template.unshift({ role: 'appMenu' })
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
