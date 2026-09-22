# Plan — Menú nativo de la aplicación y creación rápida (adaptación del PRD §8.3 y §110–118)

Hoy Writter muestra el menú por defecto de Electron (File · Edit · View · Window · Help, en inglés) y toda la
navegación vive en las pestañas de la cabecera y en el desplegable "Menú". El PRD propone un menú de aplicación
completo (File / Edit / View / Story / Tools / Window / Help), un botón "+" de creación rápida y atajos.
Se adapta a lo que Writter ya tiene: vault en vez de "proyecto", episodios/guiones en vez de "escenas" sueltas,
Planificación en vez de Story Planner/Beat Cards, Mapa neural en vez de Atlas/Constellations.

## 1. Decisiones

| PRD | Writter |
|---|---|
| Menú nativo bilingüe | `Menu.buildFromTemplate` en `main/menu.ts`; etiquetas ES/EN según el idioma del renderer (IPC `menu.setup { lang, recents }` al arrancar y al cambiar idioma/recientes). |
| Acciones del menú | Cada ítem envía `menu:<id>` al renderer; una única tabla `COMMANDS` (`renderer/commands.ts`) resuelve el id → acción del store. La misma tabla alimenta el "+" de la cabecera y los comandos `>` de la paleta (una sola fuente de verdad). |
| Quick Add "+" | Botón "+" en la cabecera con Episodio · Personaje · Locación · Ítem · Documento · Pregunta · Plant · Idea · Track · Nota rápida. Las entidades de archivo abren un modal "Nuevo…" que reutiliza `NewFile` del Escritorio; las de planificación navegan a la subvista y enfocan su campo de alta. |
| Atajos | Ctrl+1…6 pestañas · Ctrl+O abrir vault · Ctrl+N nuevo episodio · Ctrl+, preferencias · Ctrl+K buscar · Ctrl+Shift+N nota · Ctrl+H buscar y reemplazar · Ctrl+Shift+[ / ] pestaña anterior/siguiente. Registrados en el menú (Electron), visibles en Ayuda → Atajos de teclado. |
| File → Import/Export | Importar: `.fountain/.fdx`, proyecto JSON. Exportar: abre el panel Exportar del Escritorio (PDF/DOCX/FDX/Fountain/TXT del episodio activo), proyecto JSON. |
| Story menu | "Historia": nuevos episodio/personaje/locación/ítem/documento, pregunta/plant/idea/track, aplicar plantilla (Beat Timeline). *Stack* no existe en Writter (sus grupos `#` se crean desde la escena actual): fuera. |
| Tools menu | "Herramientas": Clinic, Matriz de motivación, Mapa neural, Análisis, Buscar en todo, Pomodoro (iniciar/pausar, reiniciar, saltar), Meta de palabras (Dashboard), Reindexar grafo. |
| Help | Primeros pasos / Documentación / Reportar un problema (GitHub), Atajos de teclado (modal), Acerca de (diálogo nativo con versión). |
| Account / Updates | Fuera de alcance (sin cuenta ni actualizador). |
| Sidebar + Inspector (§7/§9) | **No se cambia el layout**: las pestañas + subnavegación ya cubren la navegación; el inspector existe donde aporta (Beat Timeline, Script Assistant). Se documenta como posible fase posterior. |

## 2. Estructura del menú (ES / EN)

```
Archivo        Nuevo episodio… (Ctrl+N) · Nuevo personaje… · Nueva nota rápida… (Ctrl+Shift+N) · ─ ·
               Abrir vault… (Ctrl+O) · Recientes ▸ · Vincular carpetas… · ─ ·
               Importar ▸ (.fountain/.fdx…, Proyecto JSON…) · Exportar ▸ (Episodio actual…, Proyecto JSON…) · ─ ·
               Ajustes del proyecto · Preferencias… (Ctrl+,) · ─ · Salir
Edición        Deshacer · Rehacer · ─ · Cortar · Copiar · Pegar · Seleccionar todo · ─ · Buscar y reemplazar… (Ctrl+H) · Buscar en todo… (Ctrl+K)
Ver            Escritorio (Ctrl+1) · Breakdown (Ctrl+2) · Desarrollo (Ctrl+3) · Planificación (Ctrl+4) · Producción (Ctrl+5) · Ajustes (Ctrl+6) · ─ ·
               Desarrollo ▸ (Personajes · Beat Timeline · Mapa neural · Análisis · Documentos) ·
               Planificación ▸ (Dashboard · Planner · Preguntas · Plant & Payoff · Ideas · Clinic · Index · Biblioteca) · ─ ·
               ☐ Modo enfoque · ☐ Modo página · ☐ Etiquetas de elemento · ─ · Ampliar · Reducir · Tamaño real · Pantalla completa · ─ · Recargar · Herramientas de desarrollo
Historia       Nuevo episodio… · Nuevo personaje… · Nueva locación… · Nuevo ítem… · Nuevo documento… · ─ ·
               Nueva pregunta dramática · Nuevo plant · Nueva idea de escena · Nuevo track · ─ · Aplicar plantilla…
Herramientas   Clinic · Matriz de motivación · Mapa neural · Análisis · ─ · Buscar en todo… (Ctrl+K) · ─ ·
               Pomodoro: iniciar/pausar · Reiniciar Pomodoro · Saltar fase · ─ · Meta de palabras… · Reindexar grafo
Ventana        Minimizar · Zoom · ─ · Pestaña anterior (Ctrl+Shift+[) · Pestaña siguiente (Ctrl+Shift+]) · ─ · Cerrar
Ayuda          Primeros pasos · Documentación · Atajos de teclado… · ─ · Reportar un problema · ─ · Acerca de Writter
```

## 3. Fases

1. **Comandos**: `renderer/commands.ts` (tabla id → etiqueta ES + acción), store: `newEntity`, `shortcutsOpen`, petición de panel del Escritorio, `prevTab/nextTab`.
2. **Menú nativo**: `main/menu.ts`, IPC `menu.setup` / evento `menu`, preload y tipos; "Acerca de" y enlaces de ayuda en main.
3. **UI**: "+" de creación rápida en la cabecera, modal "Nuevo…" (reutiliza `NewFile`), modal de atajos, la paleta `>` usa `COMMANDS`, campos de alta con `data-new` para el foco.
4. **Cierre**: i18n, verificación en app (capturas del menú y del "+"), README.

## 4. Estado

| Fase | Estado |
|---|---|
| 1 Comandos | ✅ |
| 2 Menú nativo | ✅ |
| 3 UI (+, Nuevo…, atajos, paleta) | ✅ |
| 4 i18n, verificación, README | ✅ |

Diferido: menús contextuales por entidad (§119–121; hoy existe el "…" de tarjeta en Breakdown), sidebar + inspector global (§7/§9), Stack como entidad.
