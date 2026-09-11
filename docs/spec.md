---
doc: spec
version: 0.3
status: pendiente-de-aprobacion
proyecto: "Plataforma de desarrollo narrativo y preproducción"
analogia: "Remotion para escritores/guionistas — componible, determinista, con preview y render"
arquitectura: "Electron + Vite/React, local-first, .md/Obsidian, Graphify como capa de índice, BYOK"
---

# Especificación — Plataforma de Desarrollo Narrativo y Preproducción (v1)

> Documento de diseño bajo flujo Spec-Driven. No contiene código de implementación.
> Requiere aprobación explícita antes de generar el plan técnico.
> Cambios v0.1 -> v0.2: analogía Remotion, `.md` por defecto con `.fountain` opcional y tags configurables, diff para IA y usuario, decisión de framework, integración de Graphify desde la base, diseño de UI de tres paneles (mono-usuario), escala masiva.
> Cambios v0.2 -> v0.3: principio agent-first y distinción de las dos superficies MCP (lectura Graphify / plataforma WIP), §2.5.

---

## 0. Visión y Alcance

### 0.1 Visión

El sistema es a la escritura y preproducción lo que **Remotion/composición-como-código** es a la edición de video: los artefactos narrativos (guión, escenas, beats, entidades, tomas) se tratan como **datos componibles y deterministas**, con un **preview en vivo** (formato de industria + vistas de grafo) y un **pipeline de render/export** (FDX/PDF/Fountain/storyboards). El mismo texto produce siempre la misma proyección.

Es una **aplicación de escritorio mono-usuario, local-first**. El disco del usuario —un *vault* estilo Obsidian de archivos `.md`— es la única fuente de verdad. La inteligencia se ejecuta contra las **API propias del usuario (BYOK)**. Sobre el vault se construye un **grafo de conocimiento con Graphify** que sirve como capa de índice y recuperación, orientada a reducir tokens.

### 0.2 En alcance (v1)

| Módulo | Contenido | Fase |
|---|---|---|
| 1. Editor de Guión Estructurado | Formateo en vivo sobre `.md` (Fountain opcional), proyección de nodos, import/export | v1 · Fase 1 |
| 2. Motor de IA Contextual | Scopes, landing points, Script/Cinema Assistant, Script Doctor, Worldview Safeguards | v1 · Fase 1 |
| 4. Arquitectura Narrativa y Entidades | Personajes, locaciones, props, beats, arcos, knowledge files | v1 · Fase 1 |
| Índice Graphify | Grafo del vault, consulta por MCP, vistas de relaciones y arcos | v1 · Fase 1 |
| Versionado y diff | Snapshots + diff para ediciones de IA y de usuario | v1 · Fase 1 |
| 5. Preproducción Visual | Script breakdown, shot lists, storyboards vía BYOK | v1 · Fase 2 |

### 0.3 Diferido (WIP)

- **Módulo 3** — Colaboración en tiempo real (CRDT), presencia, cursores en vivo, RBAC. *Se ignora el multiusuario en v1.* El invariante de herencia de permisos de la IA sí se declara (§4).
- **Módulo 6** — Monetización SaaS: tiers, créditos de pago, Stripe. En BYOK, el "medidor de créditos" se reduce a un **medidor de uso local informativo**, y se **difiere** (WIP-lite).
- **Fuente de verdad distribuida / multi-tenant** — se reabre cuando regrese la colaboración.

### 0.4 Objetivos

1. Escribir, estructurar y hacer preproducción de un proyecto audiovisual sin salir del escritorio ni saltar entre apps externas.
2. Que **todo el contenido sea legible y editable en Obsidian** sin la app: `.md` + frontmatter YAML + enlaces `[[ ]]`.
3. Que la IA opere **sobre el nodo/estado del documento** (landing points), nunca en un chat aislado, y **nunca escriba sin aceptación explícita**.
4. Reducir el consumo de tokens: la IA consulta un **grafo indexado** (subgrafos con alcance) en lugar de recibir archivos completos.
5. Funcionar **offline** para todo salvo las llamadas a los modelos del usuario.
6. Escalar a **vaults masivos** sin degradar la edición.

---

## 1. Decisiones de Diseño Propuestas (confirmar antes de aprobar)

**D1 · Formato del guión.** Por defecto **`.md`** con Fountain embebido y frontmatter YAML; formateo en vivo. **`.fountain` es un extra opcional**: el usuario puede convertir/exportar y trabajar en `.fountain` si lo desea. La verdad sigue siendo el archivo en disco.

**D2 · Framework y editor (recomendación con justificación).** Propongo **descartar Next.js** para este caso. Next está pensado para web con servidor (SSR, RSC, rutas API); dentro de un Electron local-first esas capacidades no aplican y solo agregan peso. Recomiendo **electron-vite + React** (Vite como build del renderer, sin servidor implícito, HMR rápido, integración madura con Electron). Enrutado con TanStack Router si se necesita. Editor: **CodeMirror 6** (edita texto plano, mantiene el `.md` como verdad, git-friendly). *Alternativa si insistes en Next: `output: export` (SPA estática), aceptando el sobrecoste sin sus beneficios.*

**D3 · Tags configurables (reemplaza la regla fija de colisión de sintaxis).** Fountain y Obsidian ambos usan `[[ ]]`. En lugar de imponer una convención, el proyecto define un **mapa de tags configurable** (qué sintaxis marca un enlace a entidad, una nota, metadatos de escena). El default es seguro para Obsidian **y** para Graphify (enlaces de entidad con `[[ ]]` para que Graphify los extraiga como aristas). El editor **valida** el mapa y avisa si una elección colisiona con Fountain, Obsidian o Graphify.

**D4 · Diff para IA y usuario.** Todo cambio nuevo o nueva versión —lo escriba la IA o el usuario— genera un **diff** y un punto restaurable. El diff se muestra en el editor con aceptar/rechazar (IA) o como historial navegable (usuario).

**D5 · Módulo 5 (visual).** Incluido en v1 como **Fase 2**, a menor resolución. El núcleo de texto+entidades+grafo (Fase 1) es entregable por sí solo.

**D6 · Graphify como substrato de índice (integrado desde la base).** El vault se indexa con **Graphify** hacia un grafo (`graph.json`). Dos capas: **determinista y local** (enlaces `[[ ]]` y de Markdown entre `.md` -> aristas `references`; frontmatter -> atributos de nodo; sin LLM, gratis, offline) y **semántica opcional** (pase LLM que extrae conceptos/relaciones de la prosa; consume BYOK; puede usar **Ollama local** para ser gratis y offline). El grafo se consulta vía el **servidor MCP de Graphify** (`query_graph`, `get_node`, `get_neighbors`, `shortest_path`) para armar el contexto con alcance de la IA. *Nota honesta:* Graphify es un CLI en **Python**; su empaquetado dentro de Electron es un costo real (ver §2.4). El editor **nunca** depende de Graphify; sin él, las funciones de grafo se degradan con aviso.

---

## 2. Arquitectura del Sistema

### 2.1 Topología (mono-usuario, sin servidor remoto)

```
┌──────────────────────────────── Electron App ────────────────────────────────┐
│                                                                               │
│  Proceso MAIN (Node)                         Proceso RENDERER (Vite + React)  │
│  ─────────────────────                       ──────────────────────────────  │
│  • Filesystem del vault                       • Islas / vistas cliente:       │
│  • Watcher (chokidar)                  IPC    │   - Editor (CodeMirror 6)     │
│  • Vault de claves (safeStorage)       <───>  │   - Panel izq: entidades      │
│  • Cliente LLM / imagen (BYOK)                │   - Panel centro: canvas      │
│  • Parser Fountain/entidades                  │   - Panel der: IA + visual    │
│  • Motor de snapshots/diff                    │   - Vistas de grafo/arcos     │
│  • Orquesta Graphify  ───────────┐            │                               │
│                                  │            │                               │
└──────────────────────────────────┼───────────┴───────────────────────────────┘
                                    │ spawn (stdio)
                                    ▼
                        Graphify (subproceso Python)
                        • build/update -> graph.json
                        • graphify.serve -> MCP (query/path/explain)
                                    │
                                    ▼
                 Disco local: /Vault  (fuente de verdad · abierto en Obsidian)
                 /Vault/.narrative/graphify-out/graph.json  (índice derivado)
```

**Regla de frontera:** claves y llamadas a modelos ocurren **solo en MAIN**. El renderer nunca ve la clave; pide acciones vía IPC.

### 2.2 Estructura del vault (Graphify-native)

```
/ProjectVault
├── scripts/                 # episodios .md (Fountain embebido)
├── entities/
│   ├── characters/          # .md + frontmatter, enlaces [[ ]]
│   ├── locations/
│   └── props/
├── outline/                 # beats .md
├── knowledge/               # biblia, reglas del mundo, referencias
├── assets/                  # imágenes/storyboards (Fase 2), ruta relativa
└── .narrative/              # oculto — Obsidian lo ignora
    ├── project.yaml         # config: mapa de tags, ajustes de Graphify, backend BYOK
    ├── graphify-out/        # graph.json, GRAPH_REPORT.md (derivado, reconstruible)
    ├── versions/            # snapshots + diffs (IA y usuario)
    └── usage.log            # medidor de uso BYOK (WIP-lite)
```

Los enlaces `[[Entidad]]` en guiones y fichas se convierten en aristas de grafo **gratis y en local** (capa determinista de Graphify). `graphify-out/` se agrega a `.graphifyignore`/ignore para no contaminar la vista de Obsidian.

### 2.3 Justificación y riesgos declarados

- **Astro/Next descartados** para el renderer (§D2). electron-vite + React es el camino robusto para app local-first interactiva.
- **Fidelidad FDX/PDF**: la reconstrucción exacta de Final Draft y la paginación estándar desde `.md`/Fountain tiene límites; export PDF vía herramientas Fountain. Se acota como criterio de aceptación (§6).
- **Edición externa concurrente** (Obsidian + app abiertos): detección por hash/mtime, sin CRDT (WIP).

### 2.4 Dependencia de Graphify (Python) — riesgo de empaquetado

Graphify requiere Python 3.10+ y el paquete `graphifyy`. Opciones para v1:
- **(A) Degradable + instalación guiada (recomendado v1):** el editor funciona sin Python; al activar funciones de grafo, la app detecta/instala vía `uv tool install graphifyy` con guía. Empaquetar Python portátil queda como endurecimiento posterior.
- **(B) Python embebido:** portable + venv con `graphifyy` dentro del bundle Electron. Más peso, mejor experiencia; diferible.

*Costo/tokens honesto:* la capa determinista (enlaces + frontmatter) es gratis y offline. La capa semántica (prosa) **consume BYOK una vez por archivo cambiado**; en vaults masivos esto importa, por lo que por defecto la capa semántica es **opt-in por carpeta** o usa **Ollama local**. La recuperación en tiempo de consulta es barata.

### 2.5 Principio agent-first y superficie MCP

Al igual que Remotion (video como React) y HyperFrames (video como HTML, "hecho para agentes"), esta plataforma trata el artefacto —el vault `.md`— como fuente de verdad declarativa, determinista y **operable por un agente de IA**. Se distinguen **dos superficies MCP** para no confundirlas:

- **MCP de Graphify (v1, lectura):** consulta del grafo del vault con alcance (`query_graph`, `get_node`, `get_neighbors`, `shortest_path`). Alimenta los scopes amplios de IA (§3.5) reduciendo tokens. Es principalmente de lectura.
- **MCP de la plataforma (WIP, lectura+escritura):** expone las operaciones propias de la herramienta —abrir un scope, proponer un diff en un landing point, correr un breakdown, leer/editar un nodo— para que un agente externo (Claude Code, Codex, etc.) opere la plataforma como se opera HyperFrames al instalarse como skill. Se difiere a una fase posterior.

**Invariante de la superficie de agente:** toda escritura a través del MCP de plataforma hereda I2 (sin escritura autónoma sin aceptación o política explícita del usuario), I4 (Worldview Safeguards) e I5 (herencia de permisos). Un agente externo no obtiene más autoridad que el usuario.

*Divergencia con los referentes:* Remotion/HyperFrames renderizan píxeles cuadro a cuadro; aquí el artefacto final es texto estructurado y documentos de preproducción. Se adopta el paradigma (as-code, determinista, agent-first, preview + export, versionado), no el motor de frames.

---

## 3. Flujos de Usuario Principales

### 3.1 Abrir/crear proyecto
1. El usuario elige una carpeta como vault (o crea una con scaffolding).
2. MAIN parsea `scripts/`, lee frontmatter, resuelve `[[ ]]`, y (si Graphify está activo) construye/actualiza `graph.json`.
3. El renderer muestra los tres paneles desde la proyección + el grafo.

### 3.2 Escritura con formateo en vivo
1. El usuario escribe en CodeMirror; la sintaxis se formatea **en vivo** en `.md`.
2. Cada cambio dispara **re-parseo incremental** -> actualiza la proyección de nodos y (con debounce) `graphify update` de los archivos tocados.
3. El **panel izquierdo se actualiza en vivo** con las entidades presentes en la escena.
4. Guardado escribe el `.md`; el texto en disco es la verdad. `.fountain` solo si el usuario exporta/convierte.

### 3.3 Acción de IA con landing point
1. El usuario elige un **scope** (§3.5) e instruye.
2. MAIN arma el contexto: para scopes amplios, **consulta el grafo** (subgrafo con alcance vía MCP) en lugar de concatenar archivos; respeta el presupuesto de tokens del proveedor BYOK.
3. La respuesta se resuelve como **diff anclado a un landing point** (rango/nodo concreto).
4. El diff pasa por **Worldview Safeguards** (§4): si toca regiones/entidades `locked` sin autorización explícita en la última instrucción, se rechaza.
5. Se presenta como **aceptar/rechazar en el editor**. Aceptar = transacción con undo + snapshot/diff previo.

### 3.4 Gestión de entidades
1. Escribir `[[Arata]]` crea/enlaza `entities/characters/Arata.md` y una arista en el grafo.
2. Renombrar actualiza backlinks (semántica Obsidian) y re-indexa.
3. Atributos en frontmatter; biografía en el cuerpo.

### 3.5 Scopes de IA (contrato determinista)

| Scope | Extrae | Fuente de contexto |
|---|---|---|
| **Cursor** | posición e inmediaciones | texto local |
| **Node** | bloque/elemento actual | texto local |
| **Scene** | escena completa | texto local |
| **Range** | selección del usuario | texto local |
| **Outline** | beats + estructura | **grafo (subgrafo con alcance)** |
| **Full Context** | continuidad global | **grafo (query/path/explain), no concatenación** |

Si el slice excede el presupuesto de tokens, la app **avisa y ofrece acotar la consulta al grafo o chunking**; nunca trunca en silencio de forma que corrompa una prueba de continuidad.

### 3.6 Preproducción (Fase 2)
1. **Breakdown:** derivado del parseo + frontmatter + grafo -> escenas x (personajes, locaciones, props).
2. **Shot list:** por escena, tabla de tomas (tamaño, ángulo, movimiento, lente, estado) en `.md`/frontmatter.
3. **Storyboard/imagen:** MAIN llama a la API de imagen del usuario con contexto (personaje + locación + encuadre + lente + plano previo); guarda en `assets/` y referencia por ruta relativa.

---

## 4. Invariantes y Restricciones No Negociables

**I1 · Fuente de verdad = disco.** Los `.md` del vault son autoritativos. `graph.json` y todo `.narrative/` (salvo `versions/`) son **índice derivado y reconstruible**, nunca fuente de verdad.

**I2 · IA sin escritura autónoma.** Ninguna operación de IA modifica el disco sin aceptación explícita del usuario en el landing point.

**I3 · Claves BYOK aisladas.** Claves solo en el keychain del SO vía `safeStorage`. Jamás en el vault, ni en logs, ni en el renderer.

**I4 · Worldview Safeguards.** La IA no altera archivos/regiones `locked: true` salvo autorización explícita en la última instrucción. Validación pre-aplicación sobre el diff.

**I5 · Herencia de permisos de IA.** La IA hereda como máximo los permisos del usuario. Gancho RBAC WIP, invariante declarado.

**I6 · Compatibilidad Obsidian.** La app no introduce sintaxis que rompa el render de Obsidian. Metadatos propietarios en frontmatter YAML válido o en `.narrative/`. El mapa de tags configurable se valida contra colisiones.

**I7 · Reversibilidad.** Toda edición (IA o usuario) genera diff + snapshot; nada destruye datos sin punto restaurable.

**I8 · Offline-first.** Toda función no-IA opera sin red, incluida la capa determinista de grafo. Solo el pase semántico y las llamadas a modelos requieren red (o Ollama local); su fallo no bloquea el editor.

**I9 · Determinismo.** Mismo texto -> misma proyección de nodos. Re-parseo incremental sin perder cursor/selección.

**I10 · Detección de conflicto externo.** Cambio en disco durante edición -> detectar por hash/mtime y pedir reconciliación; nunca sobrescribir en silencio.

**I11 · Editor independiente de Graphify.** El núcleo de edición nunca depende de Python/Graphify. Sin Graphify, las funciones de grafo se deshabilitan con aviso claro, sin degradar la escritura.

**I12 · Grafo consistente con el disco.** El grafo se reconstruye desde los archivos; si queda obsoleto respecto al disco, la app lo marca y re-indexa, y nunca responde consultas de IA con un grafo que sabe desactualizado sin advertirlo.

---

## 5. Esquemas de Datos

### 5.1 Config del proyecto (`.narrative/project.yaml`)
```yaml
format:
  default: md            # md | fountain
  live_format: true
tags:                    # mapa configurable (D3), default Obsidian+Graphify-safe
  entity_link: "[[ ]]"   # enlace a entidad (Graphify lo lee como arista)
  note: "%% %%"          # nota de guionista (invisible en preview Obsidian)
graphify:
  enabled: true
  semantic_pass: opt-in  # off | opt-in | on
  backend: ollama        # ollama | claude | openai | gemini ...
byok:
  provider: anthropic    # clave en keychain, nunca aquí
```

### 5.2 Guión (`scripts/ep01.md`)
```markdown
---
type: script
id: ep01
title: "Episodio 1"
sequence: 1
status: draft            # draft | canon
locked: false
---

INT. DOJO - NOCHE

Un farol tiembla. [[Arata]] envaina la [[Katana de Arata]].

ARATA
No otra vez.

%% nota: revisar ritmo aquí %%
```

### 5.3 Personaje (`entities/characters/Arata.md`)
```yaml
---
type: character
id: chr_arata
name: "Arata"
archetype: "Héroe reticente"
status: canon
locked: false
relationships:
  - target: "[[Yuki]]"
    kind: rival
arc:
  - scene: "[[scripts/ep01#INT. DOJO - NOCHE]]"
    beat: "Negación del llamado"
    emotion: "miedo"
tags: [protagonista]
---
Biografía en prosa...
```

### 5.4 Locación / Prop / Beat / Shot
```yaml
# locations/Dojo.md -> type: location, light_conditions, scouting_notes, locked
# props/Katana.md   -> type: prop, category (utileria|vestuario), scenes[], locked
# outline/main.md   -> type: outline, method (save-the-cat|hero-journey), beats[]
# assets/shots/...  -> type: shotlist, scene, shots[] (id,size,angle,movement,lens,state,storyboard)
```

### 5.5 Gestión de estado
- **En memoria (renderer):** proyección reactiva; efímera.
- **Índice derivado:** `graph.json` (Graphify) + `index` de proyección; reconstruibles.
- **Persistente y autoritativo:** solo archivos del vault + `versions/`.
- **Sin estado de servidor.**

---

## 6. Criterios de Aceptación y Casos Límite

### 6.1 Criterios de aceptación

- **AC-1 Formateo en vivo:** al escribir, el guión se formatea en vivo y el `.md` en disco queda legible en Obsidian; `.fountain` solo aparece si el usuario exporta.
- **AC-2 Proyección viva:** al editar una escena, el panel izquierdo refleja entidades presentes sin recargar.
- **AC-3 Import/Export:** importar `.fdx`/`.fountain` produce `.md` editable; exportar a `.fountain`/`.pdf` conserva estructura de escenas y diálogos. *Pérdida de fidelidad tipográfica fina documentada, no de contenido.*
- **AC-4 Landing point:** la sugerencia de IA se aplica en el nodo/rango objetivo con aceptar/rechazar y undo; ningún chat edita por su cuenta.
- **AC-5 Scopes por grafo:** Outline y Full Context arman contexto desde subgrafos de Graphify; el conteo de tokens es visible antes de enviar y es menor que enviar los archivos completos.
- **AC-6 Safeguards:** un intento de la IA de tocar `locked: true` sin autorización se rechaza con motivo.
- **AC-7 Claves:** inspeccionar vault, logs y renderer no revela la clave BYOK.
- **AC-8 Offline:** sin red, editar/navegar/versionar/breakdown y la capa determinista del grafo funcionan; solo pase semántico y acciones de IA fallan con mensaje claro (u operan con Ollama local).
- **AC-9 Diff/versionado:** cada edición de IA aceptada y cada nueva versión de usuario crean diff restaurable línea por línea.
- **AC-10 Obsidian:** abrir el vault en Obsidian muestra guiones, fichas y grafo de enlaces sin errores de parseo.
- **AC-11 Sin Graphify:** sin Python/Graphify, el editor funciona completo y las funciones de grafo aparecen deshabilitadas con aviso, sin errores.
- **AC-12 Escala masiva:** en vault masivo, la app usa índice incremental y consulta por grafo (sin generar la viz HTML pesada), y el arranque no bloquea la edición.

### 6.2 Casos límite

1. **Edición externa concurrente** -> detectar por hash/mtime, recargar o fusionar; sin pérdida (I10).
2. **Fountain malformado** -> el editor no se bloquea; degrada a texto plano y marca el error.
3. **Diff de IA obsoleto** (documento cambió entre petición y respuesta) -> landing point "stale"; re-anclar o reintentar, nunca aplicar a ciegas.
4. **Full Context excede presupuesto** -> acotar la consulta al grafo o chunking; sin truncado silencioso.
5. **Enlace `[[ ]]` a entidad inexistente** -> marcar no resuelto u ofrecer crear ficha.
6. **Renombrar entidad** -> actualizar backlinks y re-indexar; si falla, revertir sin enlaces rotos.
7. **Colisión de tags** (Fountain vs Obsidian vs Graphify) -> el validador del mapa de tags (D3) avisa antes de guardar la config.
8. **Clave BYOK ausente/inválida/limitada** -> degradar con mensaje; sin crash ni pérdida.
9. **Python/Graphify ausente** -> funciones de grafo off, editor intacto (I11); ofrecer instalación guiada.
10. **Grafo obsoleto respecto al disco** -> marcar, re-indexar; no responder IA con grafo desactualizado sin advertir (I12).
11. **`graph.json` excede el tope de tamaño** (512 MiB por defecto en Graphify) -> subir el límite o particionar por carpeta; avisar.
12. **Costo del pase semántico en vault masivo** -> por defecto opt-in por carpeta o Ollama local; advertir gasto BYOK antes de un pase amplio.
13. **Fallo de generación de imagen** -> no dejar referencia rota; enlazar solo si se guardó.

---

## 7. Fuera de Alcance (WIP explícito)

- CRDT, presencia, cursores en vivo, edición simultánea, RBAC, hilos de equipo.
- Monetización, tiers, créditos de pago, Stripe, panel de workspace.
- Medidor de uso BYOK (WIP-lite, diferido).
- **MCP de plataforma (agent-first):** superficie de lectura+escritura para agentes externos (§2.5). Diferido.
- Sincronización en la nube y multi-tenant.

---

## 8. UI — Distribución de Tres Paneles (mono-usuario)

Tema oscuro. Se retira todo lo colaborativo del boceto original (avatares, roles, créditos, sincronización en la nube).

- **Header:** logotipo, selector de proyecto y episodio; **estado del índice** (grafo al día / re-indexando); estado de guardado; botón de exportar (`.fdx`/`.pdf`/`.fountain`).
- **Panel izquierdo (navegación y entidades):** escaleta y beats (arrastrar/reordenar), personajes y arcos (grafo interactivo al hacer clic), locaciones, props, knowledge files. Se actualiza en vivo con la escena activa.
- **Panel central (canvas de nodos):** barra flotante de **Scope** `[Cursor] [Nodo] [Escena] [Rango] [Escaleta] [Guión Completo]`; canvas con formateo de industria; **landing points** resaltados; historial/diff accesible.
- **Panel derecho (IA y preproducción):** pestaña **Script Assistant** (consola de instrucciones, Script Doctor, Advisors) y pestaña **Cinema Assistant** (feed de storyboards, shot list) — Fase 2 para lo visual.
- **Status bar:** conteo de tokens del scope activo, backend BYOK, estado de red/Ollama.

---

## 9. Preguntas Abiertas para el Plan Técnico

- Estrategia de empaquetado de Python (guiado con `uv` vs embebido) — §2.4.
- Default del pase semántico: Ollama local vs nube BYOK.
- Reparto exacto entre frontmatter y grafo para atributos de entidad.
- Umbrales de rendimiento concretos para vault masivo (nodos, latencia de re-parseo/consulta).
- Librería de export PDF Fountain a adoptar.
