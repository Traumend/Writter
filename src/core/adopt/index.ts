import { DEFAULT_CONFIG, type AdoptRole, type FolderGuess } from '../types/ipc'

// Adopción de estructura existente (Pieza 1): Writter aprende dónde está cada cosa en vez de imponer un layout.
// Núcleo puro: sin fs, testeable. La app solo lee y propone; el usuario confirma el mapa (multiidioma, I6).

// Diccionario de nombres de carpeta por rol, en varios idiomas. Es una PISTA; el usuario siempre corrige.
const DICT: Record<AdoptRole, string[]> = {
  script: ['script', 'scripts', 'guion', 'guiones', 'roteiro', 'roteiros', 'screenplay', 'episode', 'episodes', 'episodio', 'episodios', 'scene', 'scenes', 'escena', 'escenas', 'capitulo', 'capitulos'],
  character: ['character', 'characters', 'char', 'chars', 'personaje', 'personajes', 'personagem', 'personagens', 'personnage', 'personnages', 'cast', 'elenco', 'protagonist', 'protagonistas', 'people', 'gente'],
  location: ['location', 'locations', 'locacion', 'locaciones', 'lugar', 'lugares', 'set', 'sets', 'escenario', 'escenarios', 'local', 'locais', 'place', 'places', 'ambiente', 'ambientes'],
  prop: ['prop', 'props', 'utileria', 'atrezzo', 'atrezo', 'objeto', 'objetos', 'item', 'items', 'vestuario', 'wardrobe', 'attrezzo'],
  outline: ['outline', 'outlines', 'escaleta', 'escaletas', 'beat', 'beats', 'estructura', 'structure', 'plot', 'trama', 'arco', 'arcos', 'sinopsis', 'synopsis'],
  knowledge: ['knowledge', 'biblia', 'bible', 'worldbuilding', 'world', 'mundo', 'note', 'notes', 'nota', 'notas', 'reference', 'references', 'referencia', 'referencias', 'lore', 'docs', 'documentos', 'wiki'],
  assets: ['asset', 'assets', 'image', 'images', 'imagen', 'imagenes', 'img', 'imgs', 'media', 'foto', 'fotos', 'picture', 'pictures', 'recurso', 'recursos', 'storyboard', 'storyboards', 'art', 'arte']
}

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const tokens = (name: string) => strip(name).split(/[^a-z0-9]+/).filter(Boolean)

export function guessByName(name: string): AdoptRole | null {
  const ts = new Set(tokens(name))
  for (const [role, words] of Object.entries(DICT)) if (words.some((w) => ts.has(w))) return role as AdoptRole
  return null
}

const FM_TYPE: Record<string, AdoptRole> = { script: 'script', character: 'character', location: 'location', prop: 'prop', outline: 'outline', shotlist: 'assets', knowledge: 'knowledge' }

export type FolderSignals = { name: string; mdCount: number; imageCount: number; headingCount: number; fmTypes: string[] }

// Orden de señales, de más fuerte a más débil. Cae en 'ignore' solo si no hay nada útil.
export function guessRole(s: FolderSignals): AdoptRole | 'ignore' {
  const fm = s.fmTypes.map((t) => FM_TYPE[t]).find(Boolean)
  if (fm) return fm
  const byName = guessByName(s.name)
  if (byName) return byName
  if (s.imageCount > 0 && s.mdCount === 0) return 'assets'
  if (s.headingCount > 0) return 'script'
  if (s.mdCount > 0) return 'knowledge'
  return 'ignore'
}

// Convierte las filas del asistente en el mapa rol -> carpetas (descarta 'ignore').
// Un rol sin carpeta mapeada conserva su default, para poder crear archivos nuevos de ese tipo.
export function foldersToRoles(folders: FolderGuess[]): Record<AdoptRole, string[]> {
  const roles = {} as Record<AdoptRole, string[]>
  for (const k of Object.keys(DEFAULT_CONFIG.roles) as AdoptRole[]) roles[k] = []
  for (const f of folders) if (f.role !== 'ignore') roles[f.role].push(f.path)
  for (const k of Object.keys(roles) as AdoptRole[]) if (roles[k].length === 0) roles[k] = DEFAULT_CONFIG.roles[k]
  return roles
}

// Rol de una ruta según el mapa configurado: gana el prefijo de carpeta más profundo (I1: lee desde donde el usuario indicó).
export function roleOf(rel: string, roles: Record<AdoptRole, string[]>): AdoptRole | null {
  let best: AdoptRole | null = null
  let bestLen = -1
  for (const [role, dirs] of Object.entries(roles)) {
    for (const d of dirs) {
      const norm = d.replace(/\/+$/, '')
      const inside = norm === '' || norm === '.' ? true : rel === norm || rel.startsWith(norm + '/')
      if (inside && norm.length > bestLen) {
        best = role as AdoptRole
        bestLen = norm.length
      }
    }
  }
  return best
}
