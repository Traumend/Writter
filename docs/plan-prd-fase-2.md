# Fase 2 del PRD — revisión de huecos y qué se implementó

Segunda pasada sobre el PRD de planificación narrativa (v1.0, 238 secciones) comparándolo con Writter tal y como está, **adaptado a nuestro modelo**: vault `.md` + frontmatter como fuente de verdad, IA BYOK que nunca escribe sin aceptación, Electron offline y mono-usuario. Rama `feat/prd-fase-2`.

## 1. Lo que faltaba y ya está

| # | PRD | Hueco detectado | Cómo se resolvió en Writter |
|---|---|---|---|
| 1 | §12, §127 | El proyecto no tenía logline, sinopsis, género ni estado | Ficha del proyecto en `outline/Planning.md` (`logline`, `synopsis`, `genre`, `status`) y panel **Proyecto** en el Dashboard |
| 2 | §98-100 | Solo existía la meta total; sin sesión ni racha | `core/stats` (registro diario local de totales, sin contenido) + panel **Hoy**: palabras del día, meta diaria, racha y gráfico de 14 días |
| 3 | §39 | Sin línea de arco del personaje | Sección **Arco del personaje**: hitos (`arc_points` en la ficha) anclados a escenas, con salto al Escritorio |
| 4 | §41-44 | Las locaciones solo tenían nombre, alias y descripción | **Ficha de lugar**: tipo, región, atmósfera, propósito narrativo, simbolismo y secretos + jerarquía `parent` («dentro de») |
| 5 | §71, §96 | El Index era de solo lectura | Edición en línea de estado, POV, track y **etiquetas** de escena + filtros por estado/track/personaje |
| 6 | §48-49 | Una pregunta solo tenía planteamiento y respuesta | **Hitos intermedios** (`beats`) con puntos en su línea de tiempo y regla de Clinic «sin desarrollo intermedio» |
| 7 | §61-63 | La Clinic no miraba arcos ni locaciones | Nuevas reglas: arco sin hitos, hitos sin escena, locación con ficha y sin escenas. Entrada de la Clinic unificada en un solo hook (`useClinicIssues`), antes duplicada entre Dashboard y Clinic |
| 8 | §91 | Aplicar una plantilla sobrescribía actos y beats sin avisar | Modal **Fusionar / Reemplazar** (reemplazar pide confirmación y dice qué se pierde) |
| 9 | §163 | Borrar una ficha no decía a qué afectaba | Confirmación con recuento de escenas y menciones `[[ ]]` |
| 10 | §186 | La app olvidaba dónde estabas | Estado de trabajo por proyecto (pestaña y subpestaña) en `localStorage`, restaurado al abrir el vault |
| 11 | §193 | Solo se veía el nombre del vault | Migas **proyecto / vista / subvista** en la cabecera |
| 12 | §167-168 | La presencia de un track se comunicaba solo por color y no era accesible con teclado | Marca (✓) + `aria-pressed`, `title` y botón real en Planner y en la matriz de la Clinic |
| 13 | §158-160 | El Index no tenía estado vacío | Mensaje por categoría |

Pruebas: `tests/core/stats.test.ts` (3) y casos nuevos en `tests/core/planning.test.ts` (ficha de proyecto, hitos, `readArc`, tres reglas de Clinic). Verificación en la app con el arnés headless: Dashboard, Index editable, arco, ficha de lugar, plantilla fusionar/reemplazar, restauración de vista y hallazgos de la Clinic.

## 2. Diferido, con motivo

| PRD | Por qué no ahora |
|---|---|
| §185 filtros guardados | Los filtros del Index acaban de aparecer; guardarlos antes de saber cuáles se usan es adivinar |
| §107 gestor global de tags (renombrar/fusionar) | Ya se pueden poner etiquetas por escena; el gestor solo tiene sentido con decenas de tags en uso |
| §119-121 menús contextuales | Las mismas acciones están en el menú «…» de la tarjeta y en el inspector |
| §123 multi-selección | Pide un modelo de selección en todas las vistas; hoy nada lo bloquea |
| §156-157 primer arranque guiado | El vinculador de carpetas ya cubre el primer contacto |
| §165 papelera | El historial de versiones recupera cualquier archivo borrado |
| §194 multi-ventana, §187 deep links | Valor bajo en una app local de una sola ventana |

## 3. Fuera de alcance (coherente con el producto)

Cuenta, licencias, suscripción, telemetría, sincronización y colaboración (§150-155, §174-175, §215): Writter es local-first, offline y mono-usuario; el manuscrito no sale del disco del autor. SQLite + FTS (§134-135): el vault vive en memoria y la búsqueda es instantánea; se revisará si un proyecto real lo pide.
