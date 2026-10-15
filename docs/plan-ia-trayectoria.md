# Plan — IA que escribe hacia lo planeado (v1.0, 2026-10-15)

Origen: comparación con ScriptWriterX (análisis estático con REA) y decisión del usuario.
Fuera de alcance: presupuesto, financiación, fiscalidad, nómina, colaboración/sincronización, voz.

## Idea central

La IA debe apoyarse en lo que el usuario ya decidió. Si el arco del protagonista culmina en el
capítulo 10 (p. ej. obtiene la espada legendaria en España) y estamos escribiendo el 8, la IA
propone el detonante o el guiño que encamina hacia ese hito, y lo deja registrado como siembra
ligada a su pago. Todo como propuesta (I2): diff con landing point o entrada de planificación.

Los datos ya existen y van anclados a escenas (`SceneRef`): puntos de arco del personaje
(`arc_points`), siembras y pagos (`Planning.plants`), preguntas con hitos y resolución
(`Planning.questions`) y la ficha de escena (`sceneMeta`: estado, sinopsis, propósito…).

## Fases

| # | Fase | Criterio de salida |
|---|---|---|
| 0 | Quitar presupuesto; docs; PR | Hecho en `feat/swx-paridad` |
| 1 | Índice incremental: releer solo el archivo cambiado (el watcher ya da la ruta); vecindario escena → fichas enlazadas | Mover un slider en un vault de 345 archivos lee 1 archivo, no 345 |
| 2 | Resúmenes IA por escena y capítulo, en lote, aceptados uno a uno | Los resúmenes quedan en `sceneMeta.summary`; ninguno se escribe sin aceptar |
| 3 | Contexto de trayectoria (puro, con tests): lo que viene, lo que pasó, lo que falta sembrar; acción «Encaminar hacia lo planeado» | Vault de prueba: espada en cap. 10, escribiendo en el 8 → el contexto incluye el hito |
| 4 | Clínica con IA: «Proponer arreglo» por aviso; Script Doctor por enfoque | Cada propuesta llega como diff o entrada de planificación |
| 5 | Análisis entre versiones: cada análisis se guarda con fecha y hash; comparador de curvas y tabla de deltas por escena | Dos análisis del mismo guion se comparan escena a escena |
| 6 | Storyboard: varias imágenes por plano, tira por escena, generación BYOK con apariencia de las fichas | Imágenes en `assets/` solo tras aceptar |

Orden 0 → 6: la 3 y la 4 dependen del índice (1) y de los resúmenes (2).
