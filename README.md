# Writter

Plataforma de desarrollo narrativo y preproducción: escritorio, local-first, mono-usuario. El vault de archivos `.md` (compatible con Obsidian) es la única fuente de verdad; la IA usa las claves del propio usuario (BYOK) y nunca escribe sin aceptación explícita.

Especificación y plan: [docs/spec.md](docs/spec.md) · [docs/plan.md](docs/plan.md) · guía para agentes: [AGENTS.md](AGENTS.md).

## Uso

```bash
npm install
npm run dev
```

1. **Abrir vault**: elige una carpeta (se crea la estructura `scripts/ entities/ outline/ knowledge/ .narrative/` si no existe).
2. Escribe en `scripts/*.md` con sintaxis Fountain y frontmatter YAML. El formateo es en vivo; el archivo en disco no cambia de formato. Prosa (capítulos de novela) también funciona: sin encabezados Fountain, las secciones Markdown más profundas (`##`/`###`) actúan como escenas y las superiores como grupo.
3. `[[Nombre]]` enlaza entidades; Ctrl+clic abre la ficha; el panel izquierdo muestra quién está en la escena activa y ofrece crear fichas faltantes.
4. **Script Assistant**: elige un scope (Cursor · Nodo · Escena · Rango · Escaleta · Guión completo), escribe una instrucción y pide un diff. Se muestra anclado al landing point; **Aceptar** lo aplica y guarda con snapshot; **Rechazar** lo descarta. Archivos con `locked: true` requieren autorización explícita.
5. **Versiones**: cada guardado que cambia el archivo deja un punto restaurable en `.narrative/versions/`.
6. **Grafo**: capa determinista (enlaces + apariciones) siempre disponible; si `graphify` está instalado (`uv tool install graphifyy`), *Reindexar* lo ejecuta y mezcla su salida.
7. **Exportar**: PDF con formato de industria (con portada si la configuras en Ajustes), `.fountain`; importar `.fountain` / `.fdx`.

Pestañas:
- **Escritorio**: episodios por temporada, escenas con búsqueda y reordenar, gutter con etiquetas de elemento, saltos de página estimados, subrayado de entidades, Script Assistant, versiones con snapshot y comparar, exportar.
- **Breakdown**: tarjetas de personajes/locaciones/ítems con foto, grupo, actor, alias y apariciones por escena; extracción automática desde el guión; CSV.
- **Desarrollo → Personajes**: ficha estructurada, sliders de rasgos, motor de personaje (10 dimensiones), **arco** con hitos anclados a escenas, relaciones con mapa, sugerencias de IA por campo (aceptar/rechazar).
- **Desarrollo → Beat Timeline**: línea de tiempo plana con carriles Temporada · Episodio · Actos · Beats · Tensión · Escenas (alcance episodio o serie), tarjetas de color, inspector para editar (acto, beat con tensión y personajes, nota, y ficha narrativa de la escena: propósito, conflicto, resultado, lo que está en juego y cambio de valor), cabezal reproducible, muro de notas con etiquetas y conexiones, exportación de marcadores CSV/JSON y **FCPXML** para DaVinci/Final Cut. Se guarda en `outline/<episodio>.md`.
- **Desarrollo → Mapa neural**: grafo con capas, escenas como nodos, búsqueda, enfoque por niveles (clic derecho en un nodo), pan/zoom y arrastre.
- **Desarrollo → Análisis**: análisis IA por escena (estructura, trama, tema, tono, métricas, emociones) versionado en `.narrative/analysis/`; Script Doctor con heurísticas locales sin IA.
- **Planificación**: capa de planificación y diagnóstico narrativo (plan: [docs/plan-planificacion-narrativa.md](docs/plan-planificacion-narrativa.md)). Todo vive en `outline/Planning.md` (frontmatter) y en `sceneMeta` de `outline/<episodio>.md`:
  - **Dashboard**: ficha del proyecto (estado, género, logline, sinopsis), progreso vs. meta de palabras, sesión de hoy (palabras, meta diaria, racha y gráfico de 14 días), estructura, personajes, preguntas, plants, hallazgos de la Clinic, actividad.
  - **Planner**: tracks (líneas narrativas) × escenas, estado/POV/track por escena.
  - **Preguntas**: preguntas dramáticas con escena de planteo, hitos intermedios y resolución, estado, importancia y línea de tiempo.
  - **Plant & Payoff**: siembras y pagos con distancia y alertas (sin pago, sin siembra, orden invertido).
  - **Ideas**: escenas huérfanas (integrables al guion) + **Matriz de motivación**: rejilla personajes × 10 dimensiones y premisas por reglas a partir del Motor de personaje, sin IA.
  - **Clinic**: diagnóstico local (estructura, personajes, arcos, motivación, continuidad, locaciones, preguntas, plants, tracks, ritmo y curva de tensión) con severidades no absolutas, enlaces a escenas y técnicas sugeridas.
  - **Index**: navegador tabular de todo el proyecto (escenas, beats, fichas, preguntas, plants, etiquetas, notas) con orden, búsqueda, filtros, edición en línea de estado/POV/track/etiquetas, selector de columnas y CSV.
  - **Biblioteca**: técnicas, psicología y tropos (contenido original de Writter), con relacionadas, favoritos y "crear nota en el vault".
- **Compatibilidad con ScriptWriterX**: importar y exportar proyectos `.swx`/`.swxbackup` (escenas, temporadas, episodios, fichas, beats y documentos), número de escena de industria (5A, 34B) y escenas OMITIDAS, presencia por entidad (habla · presente · mención), teclado de guion (Enter inteligente y Tab que cicla el tipo de bloque) y separatas **sides** en PDF. Plan: [docs/plan-compat-scriptwriterx.md](docs/plan-compat-scriptwriterx.md).
- **Utilidades**: `Ctrl+K` búsqueda global y comandos (con `>`), `Ctrl+Shift+N` nota rápida con carpeta (Inbox, Historia, Personajes, Mundo, Investigación), Pomodoro en la cabecera, meta de palabras en el pie, export/import del proyecto en JSON versionado y vaults recientes en el menú.
- **Menú de la aplicación** (Archivo · Edición · Ver · Historia · Herramientas · Ventana · Ayuda, en el idioma de la interfaz) y botón **+ Nuevo** en la cabecera para crear episodios, fichas, preguntas, plants, ideas, tracks y notas desde cualquier vista. Atajos: `Ctrl+1…6` pestañas, `Ctrl+N` episodio, `Ctrl+O` vault, `Ctrl+H` buscar y reemplazar, `Ctrl+,` preferencias, `Ctrl+Shift+[ ]` pestaña anterior/siguiente; lista completa en Ayuda → Atajos de teclado. Plan: [docs/plan-menu.md](docs/plan-menu.md).
- **Locaciones (Breakdown)**: ficha de lugar con tipo, región, atmósfera, propósito narrativo, simbolismo y secretos, jerarquía «dentro de» entre lugares y orden por jerarquía.
- **Producción**: shot list por escena con storyboard adjunto y **notas por departamento** (13, como el break-down de dirección), en `assets/shots/<episodio>.md`.
- **Ajustes**: proveedor y modelo, clave, mapa de tags con validador, Graphify, portada del PDF, papel, prompts editables.

Proveedor de IA en `.narrative/project.yaml` → `byok.provider`: `anthropic` (clave en el keychain del SO vía la app) u `ollama` (local, sin clave). `byok.model` opcional.

## Desarrollo

```bash
npm run typecheck
npm test
npm run build
```

Ganchos de desarrollo: `WRITTER_VAULT=<ruta>` abre un vault al arrancar; `WRITTER_SHOT=<png>` guarda una captura y sale.

Estructura: `src/core` (dominio puro, testeable sin Electron) · `src/main` (fs, claves, IA, grafo) · `src/preload` (puente IPC mínimo) · `src/renderer` (React + CodeMirror 6).
