# Writter

Plataforma de desarrollo narrativo y preproducción: escritorio, local-first, mono-usuario. El vault de archivos `.md` (compatible con Obsidian) es la única fuente de verdad; la IA usa las claves del propio usuario (BYOK) y nunca escribe sin aceptación explícita.

Especificación y plan: [docs/spec.md](docs/spec.md) · [docs/plan.md](docs/plan.md) · guía para agentes: [AGENTS.md](AGENTS.md).

## Uso

```bash
npm install
npm run dev
```

1. **Abrir vault**: elige una carpeta (se crea la estructura `scripts/ entities/ outline/ knowledge/ .narrative/` si no existe).
2. Escribe en `scripts/*.md` con sintaxis Fountain y frontmatter YAML. El formateo es en vivo; el archivo en disco no cambia de formato.
3. `[[Nombre]]` enlaza entidades; Ctrl+clic abre la ficha; el panel izquierdo muestra quién está en la escena activa y ofrece crear fichas faltantes.
4. **Script Assistant**: elige un scope (Cursor · Nodo · Escena · Rango · Escaleta · Guión completo), escribe una instrucción y pide un diff. Se muestra anclado al landing point; **Aceptar** lo aplica y guarda con snapshot; **Rechazar** lo descarta. Archivos con `locked: true` requieren autorización explícita.
5. **Versiones**: cada guardado que cambia el archivo deja un punto restaurable en `.narrative/versions/`.
6. **Grafo**: capa determinista (enlaces + apariciones) siempre disponible; si `graphify` está instalado (`uv tool install graphifyy`), *Reindexar* lo ejecuta y mezcla su salida.
7. **Exportar**: PDF con formato de industria, `.fountain`; importar `.fountain` / `.fdx`.

Proveedor de IA en `.narrative/project.yaml` → `byok.provider`: `anthropic` (clave en el keychain del SO vía la app) u `ollama` (local, sin clave). `byok.model` opcional.

## Desarrollo

```bash
npm run typecheck
npm test
npm run build
```

Ganchos de desarrollo: `WRITTER_VAULT=<ruta>` abre un vault al arrancar; `WRITTER_SHOT=<png>` guarda una captura y sale.

Estructura: `src/core` (dominio puro, testeable sin Electron) · `src/main` (fs, claves, IA, grafo) · `src/preload` (puente IPC mínimo) · `src/renderer` (React + CodeMirror 6).
