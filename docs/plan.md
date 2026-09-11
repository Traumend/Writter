---
doc: plan
version: 1.0
status: pendiente-de-aprobacion
deriva-de: spec.md v0.3
regla: "Plan técnico. Aún no se escribe código de implementación. Los contratos se expresan como formas/tablas, no como lógica."
---

# Plan Técnico de Implementación — Plataforma de Desarrollo Narrativo (v1)

Deriva del `spec.md` v0.3 aprobado. Objetivo: convertir la especificación en un plan ejecutable —stack, contratos, módulos y secuencia por hitos— manteniendo los invariantes I1–I12 y las decisiones D1–D6.

---

## 1. Principios de ejecución (heredados del spec)

- Fuente de verdad = archivos `.md` en disco. Todo índice es derivado y reconstruible.
- Local-first y offline salvo llamadas a modelos BYOK. Mono-usuario. Sin servidor remoto.
- El editor nunca depende de Graphify/Python (I11). El grafo es substrato de índice, no de verdad.
- La IA nunca escribe sin aceptación explícita (I2). Claves solo en keychain, solo en el proceso main (I3).
- Determinismo del parser (I9). Agent-first: la superficie de escritura para agentes es MCP de plataforma (WIP).

---

## 2. Stack técnico definitivo

| Capa | Elección | Estado |
|---|---|---|
| Shell de escritorio | Electron (main + preload + renderer) | fijado (D2) |
| Build/dev del renderer | electron-vite + React + TypeScript | fijado (D2) |
| Editor | CodeMirror 6 (extensión de sintaxis Fountain propia) | fijado (D2) |
| Frontmatter | gray-matter (parse/serializa YAML + cuerpo) | recomendado |
| Watcher de archivos | chokidar (en main) | recomendado |
| Diff | jsdiff (diff de líneas/tokens) | recomendado |
| Import/Export FDX | parser XML (fast-xml-parser) para `.fdx` | recomendado |
| Export PDF/Fountain | afterwriting / wrap (Fountain -> PDF) | a validar en M5 |
| Índice de conocimiento | Graphify (`graphifyy`, Python 3.10+), invocado desde main | fijado (D6) |
| Cliente MCP | @modelcontextprotocol/sdk (habla con `graphify.serve`) | recomendado |
| Claves BYOK | Electron `safeStorage` (keychain del SO) | fijado (I3) |
| Cliente LLM/imagen | SDK del proveedor del usuario, solo en main | fijado (BYOK) |
| Estado del renderer | zustand | **confirmar** (alt: Redux Toolkit) |
| Vista de grafo/arcos | Cytoscape.js | **confirmar** (alt: sigma.js, d3-force) |

Nota: las versiones exactas se verifican al iniciar M0; aquí se fija la elección, no el número.

---

## 3. Arquitectura de procesos y contratos

### 3.1 Reparto de responsabilidades

- **main (Node):** filesystem del vault, watcher, `safeStorage`, cliente LLM/imagen BYOK, orquestación de Graphify (build/update + `graphify.serve`), motor de snapshots/diff, parser autoritativo.
- **preload:** puente IPC tipado y con superficie mínima (context isolation activada; nodeIntegration desactivada en el renderer).
- **renderer (React):** editor y vistas; nunca toca claves ni red; solo consume IPC.

### 3.2 Contrato IPC (forma, no implementación)

| Canal | Dirección | Entrada | Salida |
|---|---|---|---|
| `vault.open` | renderer->main | ruta de carpeta | resumen del proyecto + config |
| `vault.watch` | main->renderer | — | eventos de cambio (path, hash, mtime) |
| `file.read` / `file.write` | renderer->main | path (+ contenido) | contenido / confirmación + nuevo hash |
| `projection.get` | renderer->main | path o scope | nodos proyectados |
| `graph.status` | main->renderer | — | al-día / re-indexando / off |
| `graph.query` | renderer->main | pregunta + alcance | subgrafo |
| `ai.run` | renderer->main | scope + instrucción + landing point | diff propuesto + conteo de tokens |
| `ai.apply` | renderer->main | diff aceptado | resultado + snapshot creado |
| `version.list` / `version.restore` | renderer->main | path (+ id de versión) | historial / restauración |
| `keys.set` / `keys.status` | renderer->main | proveedor (+ clave) | estado (la clave nunca retorna) |

### 3.3 Superficies MCP

- **Graphify MCP (v1, lectura):** `query_graph`, `get_node`, `get_neighbors`, `shortest_path`, servido por `graphify.serve` sobre stdio; el main es el cliente.
- **MCP de plataforma (WIP):** expondría scope/diff/breakdown/leer-editar nodo a agentes externos, heredando I2/I4/I5. Fuera de v1.

---

## 4. Descomposición por módulos

### 4.1 Editor y parser (módulo 1)
- Extensión CM6 para Fountain-en-`.md`: tokeniza encabezados, acción, personaje, diálogo, acotación; formateo en vivo.
- Pipeline determinista: `texto -> tokens -> proyección de nodos` (escenas, personajes/locaciones/props detectados por parse + `[[ ]]` + frontmatter). Re-parseo incremental por bloque.
- Mapa de tags configurable + validador de colisiones (Fountain/Obsidian/Graphify) (D3).
- Autosave con debounce; detección de conflicto externo por hash/mtime (I10).

### 4.2 Entidades y proyección narrativa (módulo 4)
- Fichas `.md` con frontmatter; creación/enlace al escribir `[[ ]]`; renombrado con actualización de backlinks.
- Navegador izquierdo reactivo a la escena activa.
- Beats/escaleta con reordenamiento; arcos y relaciones leídos del grafo.

### 4.3 Índice Graphify (capa fundacional)
- Ciclo de vida: detección de Python -> instalación guiada (`uv tool install graphifyy`) -> `build` inicial -> `update` incremental en cambios (debounce).
- Capa determinista por defecto (gratis/offline); capa semántica opt-in por carpeta o vía Ollama local.
- `graphify.serve` como cliente MCP para consultas con alcance.
- Degradación sin Python: funciones de grafo off con aviso; editor intacto (I11).
- `graphify-out/` bajo `.narrative/` e ignorado por Obsidian.

### 4.4 Motor de IA (módulo 2)
- Abstracción de proveedor BYOK (Anthropic/OpenAI/Gemini/Ollama), solo en main.
- Ensamblado de contexto por scope: Cursor/Node/Scene/Range desde texto local; Outline/Full Context desde subgrafos (menos tokens). Conteo visible antes de enviar.
- Resolución de landing point -> diff anclado a rango/nodo.
- Validación Worldview Safeguards sobre el diff antes de ofrecerlo (rechaza toques a `locked` sin autorización explícita).
- Aceptar/rechazar en editor; aceptar dispara snapshot + aplicación transaccional.
- Script Doctor: métricas de ritmo/diálogo-acción y alertas de incoherencia (lectura, no reescritura autónoma).

### 4.5 Versionado/diff (módulos transversales)
- Snapshot + diff para toda edición nueva o nueva versión, de IA o de usuario (D4).
- Historial navegable y restauración; git opcional como respaldo.

### 4.6 Import/Export (módulo 1, salida)
- FDX (XML) in/out; Fountain in/out; PDF export. Fidelidad tipográfica fina acotada (AC-3).

### 4.7 Preproducción visual (módulo 5, Fase 2)
- Breakdown desde grafo + frontmatter; shot list en `.md`/frontmatter; storyboards vía API de imagen BYOK; assets locales por ruta relativa.

---

## 5. Hoja de ruta por hitos

Cada hito declara su criterio de salida mapeado a los AC/invariantes del spec.

| Hito | Contenido | Salida (trazabilidad) |
|---|---|---|
| **M0 · Scaffolding** | Electron+electron-vite+React+TS; IPC base; apertura de vault; lectura de `project.yaml`; `safeStorage` | Abre vault, guarda clave BYOK en keychain, IPC vivo (I3) |
| **M1 · Editor + parser** | CM6 Fountain-en-`.md`, formateo en vivo, frontmatter, mapa de tags + validador, parser incremental, autosave, conflicto externo | AC-1, AC-2, AC-10, I9, I10, D3 |
| **M2 · Entidades + Graphify** | Fichas `[[ ]]`, navegador vivo, orquestación Graphify, MCP cliente, vistas de grafo/arcos, degradación sin Python | AC-2, AC-11, AC-12, I11, I12, D6 |
| **M3 · Motor de IA** | Proveedor BYOK, scopes (grafo para amplios), conteo de tokens, landing point -> diff, safeguards, aceptar/rechazar, Script Doctor | AC-4, AC-5, AC-6, AC-7, AC-8, I2, I4, I5 |
| **M4 · Versionado/diff** | Snapshots + diff IA y usuario, historial, restauración, git opcional | AC-9, D4, I7 |
| **M5 · Import/Export** | FDX/Fountain in/out, PDF export | AC-3, D1 |
| **Fase 2 · Visual** | Breakdown, shot list, storyboards BYOK | ACs del módulo 5 |
| **Post-v1 (WIP)** | CRDT/RBAC, MCP de plataforma, monetización, medidor BYOK | §7 del spec |

Dependencias: M1 depende de M0; M2 de M1; M3 de M1+M2 (usa proyección y grafo); M4 y M5 de M1; Fase 2 de M2+M3.

---

## 6. Estrategia de pruebas

- **Determinismo del parser (M1):** arnés que verifica misma entrada -> misma proyección; corpus de guiones de prueba.
- **Safeguards (M3):** casos que confirman rechazo de diffs que tocan `locked` sin autorización.
- **Aislamiento de claves (M3):** ninguna clave aparece en vault, logs ni renderer.
- **Offline (M2/M3):** editar/navegar/versionar y capa determinista del grafo funcionan sin red; pase semántico con Ollama local.
- **Degradación sin Graphify (M2):** editor completo, funciones de grafo off con aviso.
- **Escala masiva (M2):** update incremental, sin viz HTML pesada, consulta por grafo; el arranque no bloquea la edición.
- **Conflicto externo (M1):** edición simultánea en Obsidian se reconcilia sin pérdida.
- **Import/Export (M5):** estructura de escenas/diálogos preservada; se documenta la pérdida tipográfica fina, no de contenido.

---

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Empaquetado de Python/Graphify | v1: degradable + instalación guiada con `uv` (opción A); Python embebido como endurecimiento posterior |
| Costo BYOK del pase semántico en vault masivo | Semántica opt-in por carpeta o Ollama local por defecto; aviso de gasto antes de un pase amplio |
| Fidelidad FDX/PDF | Acotar a estructura, no tipografía; pruebas de estructura; declarar límite (AC-3) |
| Rendimiento en vault masivo | Índice incremental, virtualización de UI, consulta por grafo en vez de concatenar, sin viz HTML |
| Colisión de tags | Validador del mapa de tags antes de guardar config (D3) |
| Edición externa concurrente | Reconciliación por hash/mtime; sin CRDT en v1 (I10) |
| Grafo obsoleto respecto al disco | Marcar y re-indexar; no responder IA con grafo desactualizado sin advertir (I12) |

---

## 8. Decisiones abiertas a confirmar antes de M0

1. **Estado del renderer:** zustand (recomendado) vs Redux Toolkit.
2. **Vista de grafo:** Cytoscape.js (recomendado) vs sigma.js vs d3-force.
3. **Empaquetado de Python:** guiado con `uv` (recomendado v1) vs embebido.
4. **Default del pase semántico:** Ollama local vs nube BYOK.
5. **Reparto frontmatter vs grafo** para atributos de entidad.
6. **Librería de export PDF Fountain** (afterwriting vs wrap), a validar en M5.

Umbrales de rendimiento concretos (nodos, latencia de re-parseo/consulta) se fijan al entrar a M2 con datos reales del vault.

---

## 9. Siguiente paso

Con el plan aprobado, la implementación empieza por **M0 (scaffolding)**. Recién ahí se escribe el primer código. Antes de M0 conviene cerrar las decisiones de §8; las que no cierres, propondré su default al iniciar cada hito.
