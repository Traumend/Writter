// Preproducción (ScriptWriterX §39-47) adaptada al vault: plan de rodaje, equipo, presupuesto y
// reportes derivados. Todo puro: los datos viven en `assets/preproduccion/*.md` y aquí solo se calcula.

export type SceneKey = string // `${script}#${heading}`
export const sceneKey = (script: string, heading: string): SceneKey => `${script}#${heading}`

export type ShootingDay = { id: string; date: string; call: string; location: string; scenes: SceneKey[]; notes: string }
export type CrewMember = { id: string; name: string; dept: string; role: string; phone: string; email: string; rate: string }
export type TalentMember = { id: string; name: string; character: string; agency: string; phone: string; rate: string }
export type ShootingLocation = { id: string; name: string; set: string; address: string; contact: string; permit: string; notes: string }
export type BudgetItem = { id: string; group: BudgetGroup; category: string; description: string; qty: number; unit: string; rate: number; days: number }
export type BudgetGroup = 'ATL' | 'BTL' | 'POST'

// Departamentos con su código de serie (mismo esquema que el presupuesto de industria).
export const CREW_DEPTS: [string, string][] = [
  ['1100', 'Producción ejecutiva'], ['1300', 'Dirección'], ['2100', 'Producción'], ['2200', 'Arte'], ['2600', 'Maquillaje y peinado'],
  ['2900', 'Vestuario'], ['3100', 'Especialistas'], ['3200', 'Iluminación'], ['3300', 'Cámara'], ['3400', 'Sonido'],
  ['3500', 'Locaciones'], ['3600', 'Extras'], ['3700', 'Transporte'], ['3800', 'Catering'], ['5200', 'Postproducción'], ['5400', 'VFX']
]
export const BUDGET_GROUPS: [BudgetGroup, string][] = [['ATL', 'Sobre la línea'], ['BTL', 'Bajo la línea'], ['POST', 'Postproducción']]

// Páginas en octavos, el estándar del plan de rodaje (1 página ≈ 1 minuto de pantalla).
export function eighths(minutes: number): string {
  const total = Math.max(1, Math.round(minutes * 8))
  const pages = Math.floor(total / 8)
  const rest = total % 8
  if (!pages) return `${rest}/8`
  return rest ? `${pages} ${rest}/8` : `${pages}`
}

// Day Out of Days: por personaje y jornada, SW (empieza), W (trabaja), H (espera), WF (termina),
// SWF (un solo día: empieza y termina), D (fuera).
export type DoodCode = 'SW' | 'W' | 'H' | 'WF' | 'SWF' | 'D'
export function dood(days: ShootingDay[], scenesOf: (k: SceneKey) => string[]): { character: string; codes: DoodCode[] }[] {
  const names = new Set<string>()
  const perDay = days.map((d) => new Set(d.scenes.flatMap((k) => scenesOf(k))))
  for (const s of perDay) for (const n of s) names.add(n)
  return [...names].sort().map((character) => {
    const works = perDay.map((s) => s.has(character))
    const first = works.indexOf(true)
    const last = works.lastIndexOf(true)
    const codes = works.map((w, i): DoodCode => {
      if (first < 0 || i < first || i > last) return 'D'
      if (i === first) return first === last ? 'SWF' : 'SW'
      if (i === last) return 'WF'
      return w ? 'W' : 'H'
    })
    return { character, codes }
  })
}

// Totales del presupuesto: subtotal por partida, por grupo, contingencia y gran total.
export const itemTotal = (i: BudgetItem): number => (Number(i.qty) || 0) * (Number(i.rate) || 0) * (Number(i.days) || 1)
export function budgetTotals(items: BudgetItem[], contingencyPct = 0): { byGroup: Record<BudgetGroup, number>; subtotal: number; contingency: number; total: number } {
  const byGroup: Record<BudgetGroup, number> = { ATL: 0, BTL: 0, POST: 0 }
  for (const i of items) byGroup[i.group] = (byGroup[i.group] ?? 0) + itemTotal(i)
  const subtotal = byGroup.ATL + byGroup.BTL + byGroup.POST
  const contingency = subtotal * (Math.max(0, contingencyPct) / 100)
  return { byGroup, subtotal, contingency, total: subtotal + contingency }
}

// Reparto de una jornada a partir de sus escenas (nombres únicos, en orden alfabético).
export const dayCast = (day: ShootingDay, scenesOf: (k: SceneKey) => string[]): string[] =>
  [...new Set(day.scenes.flatMap((k) => scenesOf(k)))].sort()
