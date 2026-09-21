// Character Motivation Matrix (clean-room): cruza las dimensiones motivacionales de dos personajes y
// genera premisas de escena por REGLAS (combinaciones de ejes), no por IA. Determinista: misma entrada -> mismas premisas.
import type { MotDim, Motivation } from '../planning'

export type Premise = { text: string; dims: [MotDim, MotDim]; score: number }
type Actor = { name: string; motivation: Motivation }

// Cada regla cruza un eje de A con un eje de B y describe el choque o la alineación resultante.
type Rule = { a: MotDim; b: MotDim; es: (A: string, av: string, B: string, bv: string) => string; en: (A: string, av: string, B: string, bv: string) => string }
const RULES: Rule[] = [
  { a: 'goal', b: 'fear', es: (A, av, B, bv) => `Lo que ${A} quiere (${av}) es justo lo que ${B} teme (${bv}). La escena los pone en la misma habitación.`, en: (A, av, B, bv) => `What ${A} wants (${av}) is exactly what ${B} fears (${bv}). The scene locks them in the same room.` },
  { a: 'value', b: 'desire', es: (A, av, B, bv) => `${A} protege ${av}; ${B} desea ${bv}. Uno de los dos tendrá que ceder antes de que termine la escena.`, en: (A, av, B, bv) => `${A} protects ${av}; ${B} craves ${bv}. One of them has to yield before the scene ends.` },
  { a: 'wound', b: 'pressure', es: (A, av, B, bv) => `La presión que empuja a ${B} (${bv}) roza sin querer la herida de ${A} (${av}).`, en: (A, av, B, bv) => `The pressure driving ${B} (${bv}) accidentally presses on ${A}'s wound (${av}).` },
  { a: 'belief', b: 'belief', es: (A, av, B, bv) => `${A} cree que ${av}; ${B} cree que ${bv}. Una decisión práctica los obliga a demostrar quién tiene razón.`, en: (A, av, B, bv) => `${A} believes ${av}; ${B} believes ${bv}. A practical decision forces them to prove who is right.` },
  { a: 'need', b: 'goal', es: (A, av, B, bv) => `${A} necesita ${av} sin saberlo, y la meta de ${B} (${bv}) es el camino más corto para dárselo… o negárselo.`, en: (A, av, B, bv) => `${A} unknowingly needs ${av}, and ${B}'s goal (${bv}) is the shortest path to grant it… or deny it.` },
  { a: 'conflict', b: 'transformation', es: (A, av, B, bv) => `La contradicción de ${A} (${av}) le impide ver que ${B} está cambiando (${bv}).`, en: (A, av, B, bv) => `${A}'s inner contradiction (${av}) blinds them to how ${B} is changing (${bv}).` },
  { a: 'desire', b: 'value', es: (A, av, B, bv) => `Para conseguir ${av}, ${A} tendría que pisar lo que ${B} más protege: ${bv}.`, en: (A, av, B, bv) => `To get ${av}, ${A} would have to trample what ${B} protects most: ${bv}.` },
  { a: 'fear', b: 'fear', es: (A, av, B, bv) => `${A} teme ${av} y ${B} teme ${bv}: por una vez, el mismo peligro los obliga a colaborar.`, en: (A, av, B, bv) => `${A} fears ${av} and ${B} fears ${bv}: for once, the same danger forces them to cooperate.` }
]

// Devuelve las premisas ordenadas por intensidad combinada (solo ejes con texto). Máximo `max`.
export function premises(a: Actor, b: Actor, lang: 'es' | 'en' = 'es', max = 6): Premise[] {
  const out: Premise[] = []
  const pairs: [Actor, Actor][] = [[a, b], [b, a]]
  for (const [pi, [A, B]] of pairs.entries()) for (const r of RULES) {
    if (r.a === r.b && pi === 1) continue // regla simétrica: una sola premisa
    const av = A.motivation[r.a], bv = B.motivation[r.b]
    if (!av?.text.trim() || !bv?.text.trim()) continue
    if (A === B && r.a === r.b) continue
    out.push({ text: (lang === 'en' ? r.en : r.es)(A.name, av.text.trim(), B.name, bv.text.trim()), dims: [r.a, r.b], score: av.level + bv.level })
  }
  return out.sort((x, y) => y.score - x.score).filter((p, i, all) => all.findIndex((q) => q.text === p.text) === i).slice(0, max)
}
