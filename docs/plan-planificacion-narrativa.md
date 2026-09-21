# Plan de implementación — Planificación narrativa (clean-room, adaptado a Writter)

Fuente: análisis de competencia (especificación funcional tipo Scene Surgery + PRD v1.0).
Objetivo: incorporar a Writter la capa de **planificación, diagnóstico y desarrollo narrativo** sin copiar código, textos ni taxonomías propietarias, y **adaptándola al modelo ya existente**: vault `.md` + frontmatter (Obsidian-native), disco como fuente de verdad, IA solo BYOK y nunca escribe sin aceptación, Electron offline y mono-usuario.

## 1. Principios de adaptación (decisiones)

| Tema del análisis | Decisión en Writter |
|---|---|
| Proyecto como unidad raíz | Ya existe: el **vault** es el proyecto. Sin cambios de modelo. |
| SQLite + FTS5 | **No.** El vault vive en memoria (`docs`) y es pequeño/mediano; búsqueda global en memoria sobre título+cuerpo. *Ceiling:* si un vault supera decenas de miles de líneas, indexar. |
| Persistencia de nuevas entidades | **Un solo archivo de planificación por proyecto** `outline/Planning.md` (frontmatter YAML): tracks, preguntas, plants & payoffs, ideas (escenas huérfanas), meta de palabras. Legible/editable en Obsidian; un archivo evita plumbing de nuevos `FileKind`. *Ceiling:* si hay cientos de preguntas, partir en archivos por entidad. |
| Escenas | Siguen **derivadas del guion** (una historia, muchas vistas). Metadatos por escena (track, estado, POV, tags, overrides) en `outline/<guion>.md` → `sceneMeta` indexado por **encabezado** (más estable que el índice al reordenar). |
| Referencias escena ↔ pregunta/plant | `{script, heading}`; se resuelven al renderizar. Si no se encuentra, la Clinic lo marca como "dato incompleto". |
| Character Engine (10 dimensiones) | Modelo **propio** de 10 ejes (meta, necesidad, miedo, creencia, herida, deseo, valor, conflicto, presión, transformación) en frontmatter `motivation` del personaje: texto + intensidad 0-10. Overrides por escena en `sceneMeta[heading].overrides[personaje]`. |
| CMM (matriz de motivación) | Generador de premisas **por reglas** (cruce de ejes de 2+ personajes, priorizando intensidades), sin IA. Resultado → "Añadir como idea de escena". |
| Biblioteca editorial (técnicas, psicología, tropos, plantillas) | Contenido **original escrito desde cero**, en código (`core/library`), separado de los datos del usuario. Conjunto semilla (no 800+); estructura lista para crecer. Plantillas reutilizan las ya existentes (3 actos, Save the Cat, Viaje del héroe). |
| Clinic | Diagnóstico **local y determinista** (sin IA): estructura, personajes, preguntas, plants, tracks, ritmo. Severidades no absolutas: información / vale revisar / posible inconsistencia / dato incompleto. Cada hallazgo enlaza a escenas y sugiere técnicas de la biblioteca. |
| Index | Navegador tabular de escenas/personajes/lugares/preguntas/plants/notas con búsqueda, orden y export CSV. |
| Constellations / Story Atlas | Ya cubierto en gran parte por el **Mapa neural**; se añaden nodos de pregunta/plant como enlaces desde sus vistas. No se duplica el grafo. |
| Global search / Command palette | `Ctrl+K`: busca en todas las entidades (nombre + contenido) y salta al resultado. |
| Notas globales / Quick notes | `Ctrl+Shift+N` crea `knowledge/Inbox/<fecha> título.md` sin salir del contexto. |
| Word goals / Pomodoro | Meta de palabras del proyecto en `Planning.md` (`goal`); progreso en Dashboard y pie. Pomodoro en la barra superior (25/5/15 configurables en prefs). |
| Backup / export portable | Export/import **JSON versionado** (`schemaVersion`, rutas relativas, contenido íntegro) desde el menú; recientes en localStorage. |
| Cuenta, licencias, telemetría, colaboración, CRDT | **Fuera de alcance** (coherente con offline mono-usuario). |
| Dashboard en segunda ventana, vista Map de lugares, columnas personalizables, multi-selección | **Diferido.** |

## 2. Modelo de datos (frontmatter)

`outline/Planning.md`
```yaml
type: planning
goal: 90000
tracks: [{ id, name, color }]
questions: [{ id, text, category, status, importance, introduced: {script, heading}, resolved: {script, heading}, characters: [], notes }]
plants: [{ id, title, type, plant: {script, heading}, payoffs: [{script, heading}], characters: [], notes }]
ideas: [{ id, title, summary, characters: [], track, created }]
```
`outline/<guion>.md` → `sceneMeta: { "<heading>": { track, status, pov, tags: [], overrides: { "<personaje>": "texto" } } }`
Personaje → `motivation: { goal: {text, level}, need, fear, belief, wound, desire, value, conflict, pressure, transformation }`

Estados de escena: idea · outline · planned · draft · revision · revised · final · cut.
Estados de pregunta: open · developing · partial · answered · abandoned.

## 3. Fases

1. **Core**: `core/planning` (tipos, helpers de lectura/escritura del frontmatter, resolución de referencias, ids), `core/clinic` (diagnósticos), `core/cmm` (premisas por reglas), `core/library` (contenido original). Tests.
2. **Pestaña "Planificación"** con subvistas: Dashboard · Planner (tracks × escenas, estado/POV) · Preguntas · Plant & Payoff · Ideas + CMM · Clinic · Index · Biblioteca.
3. **Personajes**: sección "Motor de personaje" (10 dimensiones con intensidad).
4. **Utilidades**: búsqueda global `Ctrl+K`, nota rápida `Ctrl+Shift+N`, Pomodoro, meta de palabras, export/import JSON, vaults recientes.
5. **Cierre**: i18n de toda la UI nueva, verificación en app (capturas), documentación.

## 4. Fuera de alcance en esta rama
Series de varios libros, Stacks más allá de secciones `#`, SQLite/FTS, segunda ventana, mapa geográfico, multi-selección, tags globales con gestor, estadísticas de sesión, menú nativo completo.
