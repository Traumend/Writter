# Writter — UI completa (A–G) · diseño

Fecha: 2026-09-11. Deriva de `docs/spec.md` v0.3. Todo sigue en `.md` + frontmatter (I1, I6); lo derivado va a `.narrative/`.

## Navegación

Pestañas superiores: **Escritorio · Breakdown · Desarrollo · Producción · Ajustes**. Desarrollo tiene subpestañas: Personajes · Beat Timeline · Mapa neural · Análisis. El Escritorio conserva los tres paneles actuales.

## A · Escritorio

- Episodios = archivos en `scripts/`; frontmatter `season`, `episode`, `title`. El panel agrupa por temporada. Crear episodio pide título y temporada.
- Escenas = encabezados del archivo. Lista con búsqueda (encabezado, opcional contenido) y reordenar (mover bloque de texto dentro del archivo, con snapshot).
- Etiquetas de elemento en un gutter de CodeMirror (HEADING, ACTION, CHARACTER, DIALOGUE, PARENTHETICAL, TRANSITION).
- Paginación estimada en `core/paginate`: líneas impresas por tipo de token con anchos estándar (acción 61 col, diálogo 35, paréntesis 25, personaje 1 línea), 55 líneas por página. Muestra saltos de página en el editor y nº de páginas.
- Subrayado de nombres de entidad conocidos en el texto.
- Versiones: snapshot con nombre; comparar una versión con la actual (diff por líneas).
- Contadores por escena y guión: palabras, tokens estimados, páginas.

## B · Breakdown

- Frontmatter de entidad: `aliases: []`, `group` (protagonist | supporting | antagonist | extra | none), `actor`, `description`, `image` (ruta relativa en `assets/`).
- `core/breakdown`: apariciones por escena en todos los guiones. Personajes por cue o alias; locaciones por coincidencia con el encabezado; props por enlace `[[ ]]`.
- Tarjetas por tipo con foto, descripción, grupo, alias, actor y lista de escenas. Botón **Extraer**: crea fichas faltantes para cues y encabezados. Export CSV.

## C · Personajes

- Frontmatter estructurado: `role`, `importance`, `arc`, `status`, `gender`, `age`, `occupation`, `logline`, `appearance`, `want`, `need`, `traits: {initiative, empathy, moral_ambiguity, inner_conflict, volatility, transformation, mystery}` (0–100), `relationships: [{target, kind, note}]`. Biografía en el cuerpo.
- Ficha editable + mapa radial de relaciones (SVG). **Sugerir con IA** por campo: propuesta → aceptar/rechazar (I2). Contexto: escenas donde aparece (proyección), no archivos completos.

## D · Análisis

- `ai.analyze` pide al modelo JSON: global `{structure, plot, theme, tone, notes[]}` y por escena `{index, summary, emotion, intensity, tension, attention, notes[]}` (0–10). Se guarda en `.narrative/analysis/<script>/<ts>.json`; se listan versiones.
- Gráficas SVG propias (líneas por escena) y paleta de emociones por escena.
- Script Doctor local sin IA: ratio diálogo/acción, longitud de escenas atípica, personajes de una sola aparición, enlaces sin ficha, diálogos muy largos.

## E · Beat Timeline

- `outline/<episodio>.md` con frontmatter `acts: [{title, summary, from, to}]`, `beats: [{id, title, note, scene, kind}]`, `notes: [{id, text, x, y, color}]`.
- Carriles horizontales: actos, beats, escenas (de la proyección). Muro de notas arrastrables. Inspector: escena seleccionada en solo lectura y "Abrir en Escritorio".

## F · Mapa neural

- Vista completa del grafo: capas conmutables (personajes, locaciones, props, escenas), nodos de escena `guion#n` unidos a las entidades presentes, búsqueda, pan/zoom, arrastrar nodos. SVG propio, sin Cytoscape.

## G · Ajustes

- Formulario sobre `project.yaml`: proveedor y modelo, mapa de tags con avisos del validador, Graphify, prompts editables (`prompts.assistant`, `prompts.analysis`), portada (`cover: {title, author, contact, draft, image}`), papel (`pdf.paper`: Letter | A4). Claves BYOK aquí.
- La portada se antepone al PDF exportado.

## Fuera (por ahora)

Producción se limita a shot list en `assets/shots/<episodio>.md` (tabla por escena). Storyboards generados por IA de imagen, islas del grafo, grupos de escenas, traducción, voz y resaltado: cuando alguien los pida.
