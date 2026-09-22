# Plan — Beat Timeline v2 (comparación con el Beat Timeline de referencia)

Referencia: captura del Beat Timeline de Script Writer X (serie completa, carriles Temporadas · Episodios ·
Actos · Beats · Escenas · Muro creativo, inspector a la derecha). Estado actual: `src/renderer/views/BeatTimeline.tsx`.

## Diagnóstico

| Síntoma | Causa en el código |
|---|---|
| Cada acto nuevo se solapa con el anterior | `+ Acto` crea `{ from: 0, to: última }`: todos los actos cubren el mismo rango y se pintan en el mismo sitio. El rango no es editable desde el timeline (solo lo fija "Aplicar plantilla"). |
| Los beats se tapan | Se posicionan en el punto medio de su escena; dos beats en la misma escena caen en el mismo `left`. |
| Las notas nacen encima de otras | Nueva nota en `x = 20 + n·26, y = 20 + n·18` (cascada) sobre notas ya existentes. |
| Aspecto de formulario, no de línea de tiempo | Cada bloque es un `input`/`textarea` con relieve neumórfico (`--raise-sm`/`--inset`) dentro de carriles hundidos; la referencia usa tarjetas planas de color con texto y edita en el inspector. |

## Correcciones (por prioridad)

### P1 · Solapamientos
1. **Actos con rango libre y editable**: `+ Acto` toma el hueco tras el último acto (o parte el último por la mitad si no queda hueco). En la tarjeta, selects `#desde – #hasta`. Si dos actos comparten escenas, se **apilan en subfilas** (empaquetado de intervalos: el carril crece).
2. **Beats en subfilas**: mismo empaquetado; ancho mínimo por tarjeta y orden por escena/posición.
3. **Notas en celda libre**: la nueva nota ocupa la primera celda vacía de una rejilla (210×130) del muro.

### P2 · Estilo de línea de tiempo (plano dentro de `main.bt`)
4. Carriles como bandas planas; bloques como **tarjetas de color sólido** (borde 1 px, sin raise/inset), texto legible: título en negrita + resumen/nota. Solo las notas conservan una sombra suave de "post-it".
5. Color: actos por índice (paleta), beats por tipo (ya), escenas por INT/EXT y **borde punteado cuando la escena aún no está escrita** (leyenda, como en la referencia).
6. **Tarjetas de solo lectura + inspector**: clic selecciona (acto, beat, nota o escena); el inspector de la derecha edita título, resumen, rango, tipo, escena, color. Desaparecen los inputs incrustados en bloques de 60 px.

### P3 · Jerarquía y contexto que tiene la referencia
7. Carril **Episodio** (bloque con nombre, nº de escenas y minutos) y carril **Temporada** cuando hay `season`; con alcance "Serie" los episodios se encadenan en el eje de tiempo.
8. Toolbar: **+ Escena** (inserta un encabezado nuevo al final del guion), **▶ reproducir** el cabezal (×1/×2/×4), contador de conexiones del muro, un solo **Exportar** (marcadores CSV · JSON).
9. Regla: timecode grande de la posición del cabezal (`S01E01 · 00:12:30`) y marcas de inicio de episodio.
10. Notas con **título + etiquetas** (idea · giro · tema); tarjetas de entidad con "Ver escenas" que aplica el filtro.
11. **Inspector persistente** (botón "Inspector" para mostrar/ocultar, ancho fijo a la derecha) en lugar de un panel flotante solo para escenas.

Fuera de alcance: A/V REF, DaVinci Pack (ya hay marcadores CSV), conexiones escena↔escena.

## Estado

| Fase | Estado |
|---|---|
| P1 solapamientos | ✅ actos con rango libre/editable y subfilas (`core/timeline`), beats en fila principal con ancho hasta el siguiente, notas en celda libre |
| P2 estilo plano + inspector | ✅ tarjetas de color sólido, escenas INT/EXT + borde punteado, inspector persistente (acto · beat · nota · escena) |
| P3 jerarquía y contexto | ✅ carriles Episodio/Temporada, alcance Serie, + Escena, ▶ cabezal ×1–×64, timecode, Exportar (CSV · JSON), notas con título/etiquetas, "Ver escenas" |
