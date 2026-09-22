# Fase 3 del PRD — última revisión de huecos

Tercera y última pasada sobre el PRD de planificación narrativa (v1.0), comparándolo con Writter ya con las fases 1 y 2 dentro. Mismo criterio: adaptar, no copiar — el vault `.md` + frontmatter sigue siendo la fuente de verdad, la IA no escribe sin aceptación y nada sale del disco del autor. Rama `feat/prd-fase-3`.

## 1. Lo que faltaba y ya está

| # | PRD | Hueco | Cómo se resolvió |
|---|---|---|---|
| 1 | §16, §18 | La escena solo tenía track, estado, POV y etiquetas: faltaban los campos narrativos | Ficha de escena en el inspector del Beat Timeline (sinopsis, propósito, conflicto, resultado, lo que está en juego, cambio de valor), guardada en `sceneMeta` del outline |
| 2 | §24, §65 | Un beat no registraba tensión ni quién participa, y no había curva de ritmo | Tensión 0-10 y personajes por beat + **carril de curva de tensión** en la línea de tiempo |
| 3 | §38 | La matriz de motivación solo existía como sliders por ficha y cruces de dos personajes | **Matriz completa** personajes × 10 dimensiones con intensidad y total, cada fila abre su ficha |
| 4 | §67, §70 | El Index no listaba beats ni etiquetas y mostraba todas las columnas siempre | Categorías **Beats** y **Etiquetas** + selector de **Columnas** por categoría (recordado entre sesiones, también al exportar CSV) |
| 5 | §43-44 | Las locaciones tenían padre pero no se veía la jerarquía | Orden **Por jerarquía** en Breakdown: padres antes que hijos, con sangrado |
| 6 | §57, §60-62 | La Clinic no cubría motivación, continuidad ni distribución | Áreas nuevas **Motivación** y **Continuidad**, y reglas de escenas fuera de los actos, tensión sin anotar y tensión que no sube hacia el final |
| 7 | §79 | La nota rápida siempre caía en `Inbox` | Selector de carpeta (Inbox · Historia · Personajes · Mundo · Investigación), recordado |
| 8 | §77 | El mapa no permitía aislar un nodo | **Enfoque**: clic derecho en un nodo y niveles 1 / 2 / 3 / todo |
| 9 | §98 | El pie no contaba la selección | Palabras de la selección junto a las de escena y guion |

Pruebas: dos casos nuevos en `tests/core/planning.test.ts` (reglas de acto suelto, curva de tensión, motivación vacía y nombres sin ficha; cobertura de `SCENE_FIELDS`). Verificación en la app con el arnés headless: **20 comprobaciones sin fallos**, incluyendo lo que queda escrito en disco.

## 2. Diferido, con motivo

| PRD | Por qué |
|---|---|
| §70 reordenar y redimensionar columnas | Ocultar ya resuelve el caso real (tablas anchas); reordenar pide arrastre en la cabecera |
| §123 multi-selección, §119-121 menús contextuales | Las acciones existen en el menú «…» y el inspector; el modelo de selección global es un cambio transversal |
| §185 filtros guardados, §107 gestor global de tags | Esperan a que el uso real diga qué filtros y qué tags se repiten |
| §156-157 primer arranque guiado, §165 papelera | El vinculador cubre el primer contacto; el historial de versiones recupera lo borrado |
| §44 vista de mapa geográfico, §194 multi-ventana, §187 deep links | Valor bajo frente a su coste en una app local de una ventana |

## 3. Fuera de alcance (invariantes del producto)

Cuenta, licencias, suscripción, telemetría, sincronización y colaboración (§150-155, §174-175, §215). SQLite + FTS (§134-135): el vault vive en memoria y la búsqueda responde al instante; se revisará solo si un proyecto real lo pide.

Con esto, el PRD queda cubierto en todo lo que tiene sentido para un editor local-first de `.md`: lo que falta es, o bien producto comercial que Writter no quiere ser, o bien refinamiento de interacción que conviene decidir con uso real.
