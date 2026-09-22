// Clinic (clean-room): diagnóstico narrativo LOCAL y determinista. No modifica la historia ni puntúa su calidad:
// muestra señales (información / vale revisar / posible inconsistencia / dato incompleto) con enlaces y técnicas sugeridas.
import { SUGGEST } from '../library'
import { resolveRef, type Planning, type SceneMeta, type SceneRef } from '../planning'

export type Severity = 'info' | 'review' | 'inconsistency' | 'incomplete'
export type Area = 'structure' | 'characters' | 'motivation' | 'continuity' | 'questions' | 'plants' | 'tracks' | 'pacing' | 'ideas'
export type Issue = { id: string; area: Area; severity: Severity; title: string; detail: string; refs: SceneRef[]; techniques: string[] }

export type ClinicScript = { path: string; name: string; scenes: { heading: string; characters: string[]; wordCount: number; minutes: number }[]; acts: { title: string; from: number; to: number }[]; sceneMeta: Record<string, SceneMeta>; beats?: { scene: number; tension?: number }[] }
export type ClinicCharacter = { name: string; group: string; appearances: number; relationships: string[]; arcPoints?: number; arcLinked?: number; motDims?: number }
export type ClinicLocation = { name: string; appearances: number }
// `missing`: nombres que aparecen en el guion pero no tienen ficha (continuidad).
export type ClinicInput = { scripts: ClinicScript[]; characters: ClinicCharacter[]; locations?: ClinicLocation[]; missing?: { characters: string[]; locations: string[] }; planning: Planning }

const gaps = (present: boolean[]): { from: number; to: number }[] => {
  const out: { from: number; to: number }[] = []
  let start = -1
  present.forEach((p, i) => { if (!p && start < 0) start = i; if (p && start >= 0) { out.push({ from: start, to: i - 1 }); start = -1 } })
  if (start >= 0) out.push({ from: start, to: present.length - 1 })
  return out
}

export function clinic(input: ClinicInput): Issue[] {
  const out: Issue[] = []
  const add = (area: Area, severity: Severity, title: string, detail: string, refs: SceneRef[] = []) => out.push({ id: `${area}-${out.length}`, area, severity, title, detail, refs, techniques: SUGGEST[area] ?? [] })
  const headings = new Map(input.scripts.map((s) => [s.path, s.scenes.map((x) => x.heading)]))
  const totalScenes = input.scripts.reduce((a, s) => a + s.scenes.length, 0)
  const ref = (script: string, i: number): SceneRef => ({ script, heading: headings.get(script)?.[i] ?? '' })

  for (const s of input.scripts) {
    const n = s.scenes.length
    if (!n) continue
    // Estructura: actos y reparto de escenas.
    if (s.acts.length === 0) add('structure', 'incomplete', `${s.name}: sin actos definidos`, 'No hay actos en el Beat Timeline; la distribución estructural no puede evaluarse.')
    else {
      const lens = s.acts.map((a) => Math.max(0, a.to - a.from + 1))
      const max = Math.max(...lens), i = lens.indexOf(max)
      if (max > n * 0.6 && s.acts.length > 1) add('structure', 'review', `${s.name}: "${s.acts[i]!.title}" concentra ${Math.round((max / n) * 100)}% de las escenas`, 'Un acto muy largo suele esconder un segundo acto sin giro de punto medio.', [ref(s.path, s.acts[i]!.from)])
    }
    // Ritmo: escenas muy largas o muy cortas respecto a la media.
    const avg = s.scenes.reduce((a, x) => a + x.minutes, 0) / n
    s.scenes.forEach((x, i) => {
      if (avg > 0 && x.minutes > avg * 2.5 && x.minutes > 2) add('pacing', 'review', `${s.name} #${i + 1}: escena muy larga (${x.minutes.toFixed(1)}m)`, `Supera 2,5× la media del episodio (${avg.toFixed(1)}m). Considera partirla o entrar más tarde.`, [ref(s.path, i)])
      if (x.wordCount < 15) add('pacing', 'incomplete', `${s.name} #${i + 1}: escena casi vacía`, 'Menos de 15 palabras: encabezado sin desarrollar.', [ref(s.path, i)])
    })
    // Estructura: escenas que quedan fuera de todos los actos definidos.
    if (s.acts.length) {
      const inAct = s.scenes.map((_, i) => s.acts.some((a) => i >= a.from && i <= a.to))
      const loose = inAct.filter((x) => !x).length
      if (loose) add('structure', 'incomplete', `${s.name}: ${loose} escena(s) fuera de los actos`, 'Hay escenas que no caen dentro de ningún acto; ajusta los rangos en el Beat Timeline.', [ref(s.path, inAct.indexOf(false))])
    }
    // Ritmo: curva de tensión de los beats (metadato opcional, PRD §65).
    const withT = (s.beats ?? []).filter((b) => typeof b.tension === 'number' && b.tension > 0)
    if ((s.beats?.length ?? 0) >= 4 && withT.length === 0) add('pacing', 'incomplete', `${s.name}: beats sin tensión anotada`, 'Sin tensión por beat no se puede ver la curva del episodio. Anótala en el inspector del Beat Timeline.')
    else if (withT.length >= 4) {
      const sorted = [...withT].sort((a, b) => a.scene - b.scene)
      const half = Math.floor(sorted.length / 2)
      const avg = (list: typeof sorted) => list.reduce((a, b) => a + (b.tension ?? 0), 0) / Math.max(1, list.length)
      if (avg(sorted.slice(half)) <= avg(sorted.slice(0, half))) add('pacing', 'review', `${s.name}: la tensión no sube hacia el final`, `Primera mitad ${avg(sorted.slice(0, half)).toFixed(1)} vs. segunda ${avg(sorted.slice(half)).toFixed(1)}. Revisa si el clímax está colocado donde quieres.`)
    }
    // Personajes: ausencia prolongada del principal y personajes de una sola escena.
    const counts = new Map<string, boolean[]>()
    s.scenes.forEach((x, i) => x.characters.forEach((c) => { if (!counts.has(c)) counts.set(c, Array(n).fill(false)); counts.get(c)![i] = true }))
    const lead = [...counts.entries()].sort((a, b) => b[1].filter(Boolean).length - a[1].filter(Boolean).length)[0]
    if (lead && n >= 6) for (const g of gaps(lead[1])) if (g.to - g.from + 1 >= Math.max(4, Math.round(n * 0.3))) add('characters', 'review', `${lead[0]} desaparece ${g.to - g.from + 1} escenas seguidas`, `Entre #${g.from + 1} y #${g.to + 1} el personaje con más presencia no aparece.`, [ref(s.path, g.from), ref(s.path, g.to)])
    for (const [c, pres] of counts) if (pres.filter(Boolean).length === 1 && n >= 5) add('characters', 'info', `${c} aparece una sola vez`, 'Personaje introducido y no reutilizado. ¿Es intencional?', [ref(s.path, pres.indexOf(true))])
    // Tracks: inactividad y tracks vacíos (por guion).
    for (const t of input.planning.tracks) {
      const pres = s.scenes.map((x) => s.sceneMeta[x.heading]?.track === t.id)
      if (!pres.some(Boolean)) continue
      for (const g of gaps(pres)) if (g.to - g.from + 1 >= 6) add('tracks', 'review', `Track "${t.name}" inactivo ${g.to - g.from + 1} escenas`, `No aparece entre #${g.from + 1} y #${g.to + 1} de ${s.name}.`, [ref(s.path, g.from), ref(s.path, g.to)])
    }
  }
  for (const t of input.planning.tracks) if (!input.scripts.some((s) => s.scenes.some((x) => s.sceneMeta[x.heading]?.track === t.id))) add('tracks', 'incomplete', `Track "${t.name}" sin escenas`, 'Asigna escenas al track desde el Planner o elimínalo.')

  // Arco de personaje: hitos declarados en la ficha y su anclaje a escenas (una historia, muchas vistas).
  for (const c of input.characters) {
    if (c.appearances < 3) continue
    if (!c.arcPoints) add('characters', 'incomplete', `${c.name}: arco sin hitos`, 'Aparece en varias escenas pero su arco no tiene hitos definidos (partida, catalizador, crisis, llegada…).')
    else if (!c.arcLinked) add('characters', 'incomplete', `${c.name}: hitos del arco sin escena`, 'Los hitos del arco no apuntan a ninguna escena; no se puede verificar dónde ocurre el cambio.')
  }
  // Locaciones con ficha pero sin uso en el guion.
  for (const l of input.locations ?? []) if (l.appearances === 0 && totalScenes > 0) add('structure', 'info', `Locación "${l.name}" sin escenas`, 'Tiene ficha pero no aparece en ningún encabezado ni mención. ¿Worldbuilding o descarte?')

  // Motivación: el motor de personaje vacío en quien sostiene la historia (PRD §57).
  for (const c of input.characters) {
    if (c.appearances < 3 || c.motDims === undefined) continue
    if (c.motDims === 0) add('motivation', 'incomplete', `${c.name}: sin motivación definida`, 'Ninguna de las diez dimensiones tiene texto. Sin meta, miedo ni herida, sus decisiones son difíciles de justificar.')
    else if (c.motDims < 4 && c.group === 'protagonist') add('motivation', 'info', `${c.name}: motivación incompleta (${c.motDims}/10)`, 'Un protagonista con pocas dimensiones rellenas rinde menos en la Matriz de motivación.')
  }
  // Continuidad: nombres que el guion usa y el vault no conoce.
  for (const n of input.missing?.characters ?? []) add('continuity', 'incomplete', `${n}: habla en el guion y no tiene ficha`, 'Créala desde Breakdown → Extraer del guión para que entre en el breakdown, el grafo y el diagnóstico.')
  for (const n of input.missing?.locations ?? []) add('continuity', 'incomplete', `${n}: locación del guion sin ficha`, 'Aparece en un encabezado pero no existe como entidad; no se puede planificar ni desglosar.')

  // Relaciones declaradas sin coincidencia en escena.
  const coAppear = new Set<string>()
  for (const s of input.scripts) for (const x of s.scenes) for (const a of x.characters) for (const b of x.characters) if (a !== b) coAppear.add(`${a.toUpperCase()}|${b.toUpperCase()}`)
  for (const c of input.characters) for (const r of c.relationships) if (totalScenes > 0 && !coAppear.has(`${c.name.toUpperCase()}|${r.toUpperCase()}`)) add('characters', 'inconsistency', `${c.name} ↔ ${r}: relación sin escena compartida`, 'La relación está declarada en la ficha pero nunca coinciden en pantalla.')

  // Preguntas dramáticas.
  for (const q of input.planning.questions) {
    const i0 = resolveRef(q.introduced, headings), i1 = resolveRef(q.resolved, headings)
    if (q.introduced && i0 === null) add('questions', 'incomplete', `Pregunta "${q.text.slice(0, 40)}": escena de introducción no encontrada`, 'La escena referenciada ya no existe o cambió de encabezado.')
    if (q.resolved && i1 === null) add('questions', 'incomplete', `Pregunta "${q.text.slice(0, 40)}": escena de resolución no encontrada`, 'La escena referenciada ya no existe o cambió de encabezado.')
    if ((q.status === 'open' || q.status === 'developing') && !q.resolved) add('questions', q.importance >= 3 ? 'review' : 'info', `Pregunta abierta: "${q.text.slice(0, 60)}"`, 'Sin escena de resolución asignada. Si es deliberado (final abierto), márcala como abandonada o parcial.', q.introduced ? [q.introduced] : [])
    if (i0 !== null && i1 !== null && q.introduced!.script === q.resolved!.script) {
      if (i1 < i0) add('questions', 'inconsistency', `Pregunta "${q.text.slice(0, 40)}" se resuelve antes de plantearse`, `Introducida en #${i0 + 1}, resuelta en #${i1 + 1}.`, [q.introduced!, q.resolved!])
      else if (i1 - i0 <= 1) add('questions', 'review', `Pregunta "${q.text.slice(0, 40)}" se responde de inmediato`, 'Apenas hay desarrollo entre la pregunta y la respuesta.', [q.introduced!, q.resolved!])
      else if (i1 - i0 >= 5 && q.beats.length === 0) add('questions', 'review', `Pregunta "${q.text.slice(0, 40)}" sin desarrollo intermedio`, `Entre #${i0 + 1} y #${i1 + 1} no hay ningún hito registrado: el público puede olvidarla. Añade pistas intermedias.`, [q.introduced!, q.resolved!])
    }
    if (q.status === 'answered' && !q.introduced) add('questions', 'incomplete', `Pregunta respondida sin escena de introducción: "${q.text.slice(0, 40)}"`, 'Registra dónde se plantea para verificar el setup.')
  }
  // Plant & payoff.
  for (const p of input.planning.plants) {
    const ip = resolveRef(p.plant, headings)
    if (!p.plant) add('plants', 'incomplete', `"${p.title}": payoff sin siembra registrada`, 'Indica la escena donde se planta el elemento.', p.payoffs)
    else if (ip === null) add('plants', 'incomplete', `"${p.title}": escena de siembra no encontrada`, 'La escena referenciada ya no existe o cambió de encabezado.')
    if (p.payoffs.length === 0) add('plants', 'review', `"${p.title}": siembra sin pago`, 'Elemento sembrado que nunca cobra sentido. Págalo o retíralo (economía del detalle).', p.plant ? [p.plant] : [])
    for (const po of p.payoffs) {
      const i1 = resolveRef(po, headings)
      if (i1 === null) { add('plants', 'incomplete', `"${p.title}": escena de pago no encontrada`, 'La escena referenciada ya no existe o cambió de encabezado.'); continue }
      if (ip !== null && p.plant!.script === po.script) {
        if (i1 < ip) add('plants', 'inconsistency', `"${p.title}": el pago ocurre antes de la siembra`, `Siembra en #${ip + 1}, pago en #${i1 + 1}.`, [p.plant!, po])
        else if (totalScenes >= 10 && i1 - ip > totalScenes * 0.6) add('plants', 'info', `"${p.title}": siembra y pago muy distantes (${i1 - ip} escenas)`, 'El lector puede haber olvidado la siembra; considera un recordatorio intermedio.', [p.plant!, po])
      }
    }
  }
  if (input.planning.ideas.length > 0) add('ideas', 'info', `${input.planning.ideas.length} idea(s) de escena sin integrar`, 'Escenas huérfanas pendientes de colocar en el guion o descartar.')
  return out
}
