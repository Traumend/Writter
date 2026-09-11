# AGENTS.md — Plataforma de Desarrollo Narrativo (v1)

Guía operativa para agentes de código (Claude Code y equivalentes). Los defaults aquí están marcados **[propuesto]**; el humano los confirma o cambia. Este archivo lo mantenemos nosotros; Graphify puede anexar su guía "always-on" al final cuando se corra `graphify claude install`.

## Fuente de verdad

`docs/spec.md` (v0.3) y `docs/plan.md` (v1.0) son la especificación y el plan aprobados. Ante cualquier duda de diseño, esos documentos mandan sobre suposiciones. No los contradigas; si algo falta, pregunta antes de improvisar.

La implementación empieza por **M0** y avanza por hitos (M0 → M1 → M2 → M3 → M4 → M5 → Fase 2). Respeta el criterio de salida de cada hito antes de pasar al siguiente. No te adelantes a hitos posteriores.

## Invariantes no negociables (del spec)

- **I1 · Fuente de verdad = disco.** Los `.md` del vault son autoritativos. `graph.json` y todo `.narrative/` (salvo `versions/`) son índice derivado y reconstruible.
- **I2 · IA sin escritura autónoma.** Ninguna acción de IA modifica el disco sin aceptación explícita del usuario en el landing point.
- **I3 · Claves BYOK aisladas.** Solo en el keychain del SO vía `safeStorage`, solo en el proceso `main`. Jamás en el vault, en logs ni en el `renderer`.
- **I4 · Worldview Safeguards.** No alterar archivos/regiones `locked: true` sin autorización explícita en la última instrucción. Validar el diff antes de ofrecerlo.
- **I5 · Herencia de permisos de IA.** La IA no obtiene más autoridad que el usuario.
- **I9 · Determinismo.** Mismo texto → misma proyección de nodos. Re-parseo incremental sin perder cursor/selección.
- **I10 · Conflicto externo.** Cambio en disco durante edición → reconciliar por hash/mtime; nunca sobrescribir en silencio.
- **I11 · Editor independiente de Graphify.** El núcleo de edición nunca depende de Python/Graphify. Sin él, funciones de grafo off con aviso; el editor sigue completo.
- **I12 · Grafo consistente con disco.** Si el grafo queda obsoleto, marcar y re-indexar; no responder IA con grafo desactualizado sin advertir.

## Guardarraíles de alcance

**Construir (v1):** editor + parser, entidades, índice Graphify, motor de IA (scopes, landing points, safeguards), versionado/diff, import/export. Preproducción visual en Fase 2.

**NO construir (diferido, WIP):** colaboración en tiempo real (CRDT), presencia/cursores, RBAC, monetización/Stripe/tiers, **MCP de plataforma**, medidor de uso BYOK, sincronización en la nube, multi-tenant. Si una tarea parece requerir esto, detente y consulta.

## Stack (fijado / [propuesto])

| Capa | Elección |
|---|---|
| Shell | Electron (main + preload + renderer) |
| Build | electron-vite + React + TypeScript (strict) |
| Editor | CodeMirror 6 (extensión Fountain propia) |
| Frontmatter | gray-matter |
| Watcher | chokidar (en main) |
| Diff | jsdiff |
| Import FDX | fast-xml-parser |
| Export PDF/Fountain | afterwriting / wrap [propuesto, validar en M5] |
| Índice | Graphify (`graphifyy`, Python 3.10+), invocado desde main |
| Cliente MCP | @modelcontextprotocol/sdk (habla con `graphify.serve`) |
| Claves | Electron `safeStorage` |
| Estado renderer | zustand **[propuesto]** (alt: Redux Toolkit) |
| Vista de grafo | Cytoscape.js **[propuesto]** (alt: sigma.js, d3-force) |

## Entorno y convenciones

- Runtime: **Node LTS**; gestor: **pnpm [propuesto]**. Python 3.10+ para Graphify.
- Empaquetado de Graphify: **instalación guiada con `uv` [propuesto]** (`scripts/graphify-setup`); Python embebido queda para después.
- Pase semántico de Graphify: **Ollama local por defecto [propuesto]**; nube BYOK opt-in por carpeta.
- TypeScript estricto. Pruebas con **Vitest [propuesto]**. Lint/format con **Biome [propuesto]** (alt: ESLint+Prettier).
- Electron: `contextIsolation` activado, `nodeIntegration` desactivado en el renderer. El renderer no toca fs, claves ni red; todo pasa por IPC (contratos en `docs/plan.md` §3.2).
- Commits: convencionales (`feat:`, `fix:`, `docs:`, `test:`).
- El **vault es dato de usuario, NO vive en el repo**: se abre en runtime. No crear un vault dentro del repositorio salvo `tests/fixtures/` para pruebas.

## Árbol de repositorio objetivo

```
narrative-platform/
├── AGENTS.md
├── package.json
├── electron.vite.config.ts
├── tsconfig.json                 # strict
├── biome.json
├── vitest.config.ts
├── docs/
│   ├── spec.md                   # fuente de verdad (v0.3)
│   └── plan.md                   # plan técnico (v1.0)
├── src/
│   ├── core/                     # dominio puro, sin Electron — unit-testable
│   │   ├── parser/               # Fountain-en-md -> tokens
│   │   ├── projection/           # tokens+frontmatter+[[links]] -> nodos
│   │   ├── tags/                 # mapa de tags + validador (D3)
│   │   ├── scopes/               # ensamblado de contexto por scope
│   │   ├── diff/                 # snapshot + diff (D4)
│   │   ├── safeguards/           # validación worldview sobre diffs (I4)
│   │   └── types/                # contratos de datos compartidos
│   ├── main/
│   │   ├── index.ts              # bootstrap del proceso main
│   │   ├── ipc/                  # handlers de canales (plan §3.2)
│   │   ├── vault/                # fs + watcher + hash/mtime (I10)
│   │   ├── keys/                 # safeStorage (I3)
│   │   ├── ai/                   # proveedor BYOK (solo main)
│   │   ├── graph/                # orquestación Graphify + cliente MCP (D6, I11/I12)
│   │   └── versions/             # persistencia de .narrative/versions
│   ├── preload/
│   │   └── index.ts              # puente IPC tipado, superficie mínima
│   └── renderer/
│       ├── App.tsx
│       ├── editor/               # CM6 + extensión Fountain, landing points
│       ├── panels/               # izquierdo / centro / derecho
│       ├── graph-views/          # arcos/relaciones (Cytoscape)
│       ├── stores/               # zustand
│       └── ipc/                  # wrappers de acceso a preload
├── tests/
│   ├── core/                     # determinismo parser, safeguards, tags
│   └── fixtures/                 # guiones/vault de prueba
└── scripts/
    └── graphify-setup.*          # detección/instalación guiada de graphifyy (uv)
```

Regla de capas: `core/` es puro y testeable sin Electron (clave para las pruebas de determinismo). `main/` conecta `core/` con el SO. `renderer/` no importa de `main/` ni de `core/` con dependencias de Node; consume vía IPC.

## Acuerdo de trabajo

1. Lee `docs/spec.md` y `docs/plan.md` antes de escribir código.
2. Empieza en **M0** con su criterio de salida; no saltes hitos.
3. Confirma con el humano las decisiones abiertas del plan §8, o usa los **[propuesto]** de arriba.
4. Al correr Graphify aparecerán `graphify-out/` y una sección anexada a este `AGENTS.md`; añade `graphify-out/` a `.gitignore` según su guía.
5. Toda escritura de IA se propone como diff para aceptación; nada se aplica solo (I2).
