// Contenido de ejemplo para proyectos nuevos (I): la interfaz nunca arranca vacía.
// Enseña qué es cada cosa y es 100% borrable. Sirve de base para un tutorial futuro.
export type SeedFile = { path: string; content: string }

const SCRIPT = 'scripts/Episodio de ejemplo.md'
const OUTLINE = 'outline/Episodio de ejemplo.md'

export function seedFiles(): SeedFile[] {
  return [
    {
      path: SCRIPT,
      content: `---
type: script
title: "Episodio de ejemplo"
season: 1
episode: 1
status: draft
locked: false
---

%% Este es un guión de ejemplo: bórralo cuando empieces el tuyo. Escribe encabezados con INT./EXT., el nombre del personaje en MAYÚSCULAS antes de su diálogo, y enlaza entidades con [[dobles corchetes]]. %%

INT. CAFETERÍA - DÍA

[[Protagonista]] espera en una mesa del fondo. Entra [[Antagonista]] con el [[Objeto clave]] en la mano.

PROTAGONISTA
Sabía que vendrías.

ANTAGONISTA
(sonriendo)
Nunca tuve muchas opciones.

EXT. LOCACIÓN DE EJEMPLO - NOCHE

La lluvia cae con fuerza. PROTAGONISTA corre entre las sombras.

PROTAGONISTA
No pueden atraparme ahora.

INT. ESCONDITE - NOCHE

PROTAGONISTA revisa el [[Objeto clave]]. Algo no cuadra.

PROTAGONISTA
(para sí)
Esto lo cambia todo.
`
    },
    {
      path: 'entities/characters/Protagonista.md',
      content: `---
type: character
name: "Protagonista"
group: protagonist
aliases: []
role: "Protagonista"
importance: "Principal"
arc: "Positivo"
status: "Vivo"
logline: "Alguien común arrastrado a un conflicto que lo supera."
locked: false
traits:
  initiative: 70
  empathy: 65
  moral_ambiguity: 40
  inner_conflict: 60
  volatility: 45
  transformation: 75
  mystery: 50
want: "Recuperar lo que perdió."
need: "Aprender a confiar en alguien más."
relationships:
  - target: "Antagonista"
    kind: "rival"
    note: "Viejos socios, hoy enfrentados."
---
Ejemplo de ficha de personaje. Escribe aquí la biografía en prosa. Los deslizadores de la derecha ("Perfil creativo") describen su temperamento. Bórralo cuando crees el tuyo.
`
    },
    {
      path: 'entities/characters/Antagonista.md',
      content: `---
type: character
name: "Antagonista"
group: antagonist
aliases: []
role: "Antagonista"
importance: "Principal"
status: "Vivo"
logline: "El espejo oscuro del protagonista."
locked: false
traits:
  initiative: 80
  empathy: 30
  moral_ambiguity: 85
  volatility: 70
want: "Cerrar cuentas del pasado."
relationships:
  - target: "Protagonista"
    kind: "rival"
    note: "Comparten una historia que nadie más conoce."
---
Ejemplo de antagonista. Un buen villano quiere algo comprensible por las razones equivocadas.
`
    },
    {
      path: 'entities/locations/Locación de ejemplo.md',
      content: `---
type: location
name: "Locación de ejemplo"
aliases: []
locked: false
---
Ejemplo de locación. Describe el lugar, la luz y el ambiente. Aparece en el guión dentro del encabezado de escena.
`
    },
    {
      path: 'entities/props/Objeto clave.md',
      content: `---
type: prop
name: "Objeto clave"
category: utileria
locked: false
---
Ejemplo de utilería. Se enlaza en el guión con [[Objeto clave]] y aparece en el Breakdown.
`
    },
    {
      path: OUTLINE,
      content: `---
type: outline
title: "Episodio de ejemplo"
acts:
  - title: "Acto 1"
    summary: "Planteamiento: se presenta a los personajes y el conflicto."
    from: 0
    to: 1
  - title: "Acto 2"
    summary: "Confrontación: sube la tensión."
    from: 2
    to: 2
beats:
  - id: seed-b1
    title: "Detonante"
    note: "El encuentro en la cafetería lo pone todo en marcha."
    scene: 0
    kind: setup
  - id: seed-b2
    title: "Giro"
    note: "La persecución revela algo inesperado."
    scene: 1
    kind: twist
  - id: seed-b3
    title: "Clímax"
    note: "El objeto clave cambia las reglas."
    scene: 2
    kind: climax
notes:
  - id: seed-n1
    text: "Idea: revelar el pasado compartido entre protagonista y antagonista más adelante."
    x: 32
    y: 28
    color: "#3a2a10"
  - id: seed-n2
    text: "Muro creativo: arrastra estas notas, crea nuevas y bórralas libremente."
    x: 250
    y: 90
    color: "#102a3a"
---
`
    },
    {
      path: 'knowledge/Biblia del proyecto.md',
      content: `---
type: knowledge
title: "Biblia del proyecto"
---
Ejemplo de archivo de conocimiento: reglas del mundo, tono, referencias y decisiones. La IA puede usar estos archivos como contexto sin que tengas que pegarlos. Bórralo o reescríbelo con tu propio material.
`
    }
  ]
}
