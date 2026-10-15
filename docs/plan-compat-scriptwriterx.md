# Compatibilidad con ScriptWriterX

Writter se basa en ScriptWriterX (SWX). Esta pasada revisa los dos documentos de referencia —el PRD funcional de SWX y el informe de ingeniería inversa de la v60.209— y lleva a Writter lo que falta **para que un proyecto pueda ir y venir entre las dos aplicaciones** y para que quien viene de SWX encuentre aquí su vocabulario. Rama `feat/swx-compat`.

Criterio: copiamos el **modelo de dominio y los contratos**, no la implementación (el propio informe lo recomienda en §28). El vault `.md` + frontmatter sigue siendo la fuente de verdad; SWX guarda en IndexedDB y exporta un ZIP, así que la compatibilidad se resuelve en la frontera (import/export), no cambiando nuestro almacenamiento.

## 1. Interoperabilidad real (lo que antes no existía)

| # | Qué | Detalle |
|---|---|---|
| 1 | **Importar `.swx` / `.swxbackup`** | Menú *Archivo → Importar → Proyecto de ScriptWriterX*. Lee el ZIP (entradas *stored* y *deflate*, sin dependencias) y traduce `project.json`: escenas (HTML `<p class>` → Fountain), temporadas/episodios → un guion `.md` por episodio con `season`/`episode`, personajes/lugares/objetos → fichas con alias y descripción, beats → escaleta, documentos de desarrollo → conocimiento. Resumen con recuentos antes de escribir nada; lo existente queda versionado. Detecta los archivos cifrados (`SWXENC1`) y pide exportarlos sin contraseña. |
| 2 | **Exportar `.swx`** | Menú *Archivo → Exportar → Proyecto a ScriptWriterX*. `project.json` (esquema 41) dentro de un ZIP: escenas en HTML por bloques, número y estado de escena, presencia por entidad, temporadas, episodios y fichas. |
| 3 | **Marcadores para montaje (FCPXML)** | Exportación del Beat Timeline equivalente al "DaVinci Pack": actos, beats y escenas como marcadores cuantizados a fotograma que DaVinci Resolve y Final Cut importan. |
| 4 | **Sides (PDF)** | Separata por ficha desde el menú de la tarjeta en Breakdown: solo las escenas donde aparece, en formato de guion. |

## 2. Paridad de dominio

| # | SWX | En Writter |
|---|---|---|
| 5 | Estados de escena (sin estado · en curso · en revisión · terminada) | Mapeados en ambos sentidos contra nuestros ocho estados, tolerando acentos y sinónimos del inglés |
| 6 | Número de escena con gramática de industria (12, 5A, 34BC) y **OMITIDA** | Campos `numero` y `omitida` en `sceneMeta`, editables en el inspector del Beat Timeline y visibles en el Index |
| 7 | Presencia por entidad **Habla / Presente / Mención** | `presencia` en `sceneMeta`, editable por chips en el inspector (ciclo habla → presente → mención → sin marcar); es la base del desglose, los sides y el diagnóstico |
| 8 | Smart Enter y Tab del editor | `Enter` abre el bloque que toca (diálogo pegado al personaje, línea en blanco para lo demás) y `Tab`/`Shift+Tab` ciclan el tipo de la línea (acción → encabezado → personaje → acotación → transición). El frontmatter queda protegido |
| 9 | Presets de estructura | Añadidos Cinco actos, Story Circle, Kishōtenketsu y Sitcom a los que ya había (tres actos, Save the Cat, Viaje del héroe) |
| 10 | Notas por departamento del break-down de dirección (13) | Panel en Producción por escena: arte, vestuario, maquillaje, sonido, efectos, VFX, locación, fotografía, iluminación, edición, dirección de escena, sugerencias de rodaje y notas generales |
| 11 | Vista por rol | Ya existía: presets Completo · Escritor · Director · Productor en Preferencias (el rol "Administrador" de SWX coincide con nuestro Productor) |

## 3. Pendiente, con motivo

| Tema | Por qué todavía no |
|---|---|
| Revisiones por colores con numeración bloqueada (White, Blue, Pink…) | Es la fase más grande del informe (F8): afecta a editor, vista previa y PDF. Ya existen las piezas de datos (`numero`, `omitida`); el flujo de revisión merece su propia rama |
| Número de escena en el PDF exportado | El motor de exportación numera por orden; usar `numero` exige pasarle los metadatos de escaleta |
| Importar PDF con OCR | SWX usa PDF.js + Tesseract en workers; entra cuando toque el importador de PDF |
| Perfiles de estilo de reescritura (9 de fábrica) y prompts como archivos | Encaja con nuestros prompts editables del proyecto; conviene diseñarlo junto con el asistente |
| Storyboard con imágenes de IA, plan de rodaje, llamados, reportes DOOD | Preproducción avanzada; Writter cubre hoy shot list y notas por departamento |
| Medios del `.swx` (fotos, storyboard) | La importación los cuenta y avisa; escribir binarios necesita su propio canal IPC |

## 4. Fuera de alcance (decisión de producto)

Producción financiera y fiscal mexicana (CFDI, IVA, ISR, IMSS, incentivos), crew y talento con datos bancarios, licencias y planes de pago, telemetría y relay CORS: SWX los necesita por ser web y comercial; Writter es local, offline y sin cuenta. El informe mismo recomienda no meter la lógica fiscal en el núcleo (§28.3).

## 5. Comprobación

- Núcleo: `tests/core/swx.test.ts` (traducción de bloques, ida y vuelta HTML↔Fountain, estados, presencia, `swxToVault`, `vaultToSwx` y validez de los archivos generados para nuestro propio motor) y `tests/main/swx.test.ts` (ZIP *stored* y *deflate*, `backup.json`, cifrado e inválidos). Teclado de guion en `tests/core/blocks.test.ts`; FCPXML en `tests/core/timeline.test.ts`. 80/80 en total.
- En la app (arnés headless): inspector con número/omitida/presencia escribiendo en la escaleta, Index con número de industria y marca OMITIDA, notas por departamento guardadas en el shot list, menús de `.swx` y FCPXML, acción Sides, presets nuevos y el teclado de guion (Tab cicla, Enter pega el diálogo, el frontmatter no se toca). Regresión `flows-1` y `flows-3` sin fallos.
