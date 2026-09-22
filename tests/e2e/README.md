# Pruebas de extremo a extremo (harness headless)

Scripts de `WRITTER_EVAL`: se ejecutan dentro del renderer de la app real. Cada uno devuelve `'__more__'` por paso y, al final, un JSON con `[paso, nombre, ok, detalle]`.

```bash
npm run build
cp -r <vault de prueba> /tmp/vault-e2e   # copia desechable; los flujos escriben en el vault
WRITTER_VAULT=/tmp/vault-e2e WRITTER_EVAL=tests/e2e/flows-1.js WRITTER_SHOT=/tmp/e2e/s.png ./node_modules/electron/dist/electron.exe .
```

- `flows-1.js` — Escritorio, Breakdown, Personajes, Planificación (8 subvistas), Producción, Ajustes, paleta, nota rápida, buscar/reemplazar, mapa, análisis, documentos, Beat Timeline y vinculador.
- `flows-2.js` — IA sin clave, preferencias (acento, escala, presets de pestañas), paleta → escena, reindexar, menú.
- `flows-3.js` — renombrar entidad con enlaces, reordenar escenas, versiones, panel Exportar, grupos, mapa (doble clic), ajustes (ollama), preguntas → clinic → index.
- `external-change.js` — un proceso externo modifica una ficha mientras la app corre (tocar el archivo ~25 s después de arrancar) y la vista se actualiza.
- `adopt.js` — abrir una carpeta sin `.narrative` propone roles y "Vincular y abrir" crea el proyecto.

Los flujos leen etiquetas en español o inglés (la app guarda el idioma en `localStorage`, compartido con la app de desarrollo). El resultado se lee de la línea `[eval] [[…]]` de la salida; `[renderer]` muestra avisos/errores de consola.
