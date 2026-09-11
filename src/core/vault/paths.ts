import { resolve, sep } from 'node:path'

// Resuelve una ruta relativa dentro del vault; rechaza escapes fuera de la raíz (frontera de confianza, I1).
export function resolveInside(root: string, rel: string): string {
  const base = resolve(root)
  const abs = resolve(base, rel)
  if (abs !== base && !abs.startsWith(base + sep)) throw new Error('Ruta fuera del vault')
  return abs
}
