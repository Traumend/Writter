// Interoperabilidad con ScriptWriterX (.swx / .swxbackup): el proyecto de SWX es un ZIP con `project.json`
// (43 tablas) y una carpeta `media/`. Aquí vive la traducción PURA entre ese JSON y nuestro vault de .md:
// el contenido de escena viaja como HTML `<p class="tipo">` y nosotros trabajamos en Fountain dentro de .md.
import { parseFountain } from '../parser/fountain'
import { project as projectScenes } from '../projection'
import { readFrontmatter } from '../frontmatter'
import type { Presence, SceneMeta, SceneStatus } from '../planning'

export type SwxRow = Record<string, unknown>
export type SwxFile = {
  project?: SwxRow
  seasons?: SwxRow[]
  episodes?: SwxRow[]
  scenes?: SwxRow[]
  characters?: SwxRow[]
  locations?: SwxRow[]
  items?: SwxRow[]
  sceneGroups?: SwxRow[]
  sceneEntityStatus?: SwxRow[]
  beats?: SwxRow[]
  devDocuments?: SwxRow[]
  [k: string]: unknown
}

export type VaultFile = { path: string; content: string }
export type ImportReport = { scripts: number; scenes: number; characters: number; locations: number; items: number; beats: number; docs: number; media: number }
export type Roles = { script: string; character: string; location: string; prop: string; knowledge: string; outline: string }

const str = (v: unknown): string => (v == null ? '' : String(v))
const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0)
const arr = (v: unknown): SwxRow[] => (Array.isArray(v) ? (v as SwxRow[]) : [])
const yamlStr = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
// Nombre de archivo seguro en Windows y macOS conservando acentos.
export const safeName = (s: string): string => s.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Sin titulo'

// --- Texto -------------------------------------------------------------------

// Entidades nombradas que aparecen de verdad en guiones ES/EN/FR (el resto viaja como &#NNN;).
const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '-', mdash: '-', hellip: '…', laquo: '«', raquo: '»',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', uuml: 'ü', ccedil: 'ç',
  agrave: 'à', egrave: 'è', ugrave: 'ù', acirc: 'â', ecirc: 'ê', icirc: 'î', ocirc: 'ô', ucirc: 'û', euml: 'ë', iuml: 'ï',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', Uuml: 'Ü', Ccedil: 'Ç',
  iquest: '¿', iexcl: '¡', deg: '°', ordm: 'º', ordf: 'ª', middot: '·', euro: '€', pound: '£', copy: '©', reg: '®'
}
const decode = (s: string) =>
  s.replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&([a-zA-Z]+);/g, (m, n: string) => ENTITIES[n] ?? ENTITIES[n.toLowerCase()] ?? m)

const plain = (html: string) =>
  decode(html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''))
    .replace(/\u00a0/g, ' ')
    .split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter((l, i, a) => l || (i > 0 && i < a.length - 1))
    .join('\n').trim()

// Tipo de bloque de SWX a partir del atributo class (acepta varias clases y nombres alternativos).
export function blockType(cls: string): string {
  const c = cls.toLowerCase()
  for (const [re, type] of [
    [/scene[-_ ]?heading|heading|sceneheading/, 'scene-heading'],
    [/parenthetical|paren/, 'parenthetical'],
    [/character|cue/, 'character'],
    [/dialogue|dialog/, 'dialogue'],
    [/transition/, 'transition'],
    [/\bnote\b|nota/, 'note'],
    [/\bact\b|acto/, 'act'],
    [/episode|episodio/, 'episode'],
    [/action|accion|acción/, 'action']
  ] as [RegExp, string][]) if (re.test(c)) return type
  return 'none'
}

// HTML de escena de SWX -> Fountain. Conserva el diálogo pegado a su personaje y las notas como %% … %%.
export function htmlToFountain(html: string): string {
  const blocks = [...html.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi)].map((m) => ({ type: blockType(/class="([^"]*)"/i.exec(m[1] ?? '')?.[1] ?? ''), text: plain(m[2] ?? '') }))
  if (blocks.length === 0) return plain(html) // contenido ya plano (importaciones antiguas)
  const out: string[] = []
  let prev = ''
  for (const b of blocks) {
    if (!b.text) { prev = ''; continue }
    const glued = (b.type === 'dialogue' || b.type === 'parenthetical') && (prev === 'character' || prev === 'dialogue' || prev === 'parenthetical')
    if (!glued && out.length) out.push('')
    switch (b.type) {
      case 'scene-heading': { const h = b.text.toUpperCase(); out.push(/^(INT|EXT|EST|I\/E)[.\s]/.test(h) ? h : `.${h}`); break }
      case 'character': out.push(b.text.toUpperCase()); break
      case 'parenthetical': out.push(/^\(.*\)$/.test(b.text) ? b.text : `(${b.text})`); break
      case 'transition': { const tr = b.text.toUpperCase(); out.push(tr.endsWith('TO:') ? tr : `> ${tr}`); break }
      case 'note': out.push(`%% ${b.text} %%`); break
      case 'act': case 'episode': out.push(`# ${b.text}`); break
      default: out.push(b.text)
    }
    prev = b.type
  }
  return out.join('\n').trim()
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const HTML_CLASS: Record<string, string> = { heading: 'scene-heading', action: 'action', character: 'character', parenthetical: 'parenthetical', dialogue: 'dialogue', transition: 'transition', note: 'note', section: 'act', synopsis: 'action', centered: 'action' }

// Fountain (.md) -> HTML de escena de SWX. Es la inversa de htmlToFountain para el viaje de ida y vuelta.
export function fountainToHtml(md: string): string {
  const { tokens } = parseFountain(md)
  return tokens
    .filter((t) => t.type !== 'frontmatter' && t.type !== 'blank')
    .map((t) => {
      const cls = HTML_CLASS[t.type] ?? 'none'
      const text = t.text.replace(/^(\.|@|!|>\s*|#+\s*)/, '').replace(/\s*\^$/, '').replace(/^%%\s*|\s*%%$/g, '').trim()
      return `<p class="${cls}">${esc(text)}</p>`
    })
    .join('\n')
}

// --- Estados y presencia -----------------------------------------------------

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
// Los cuatro estados de SWX contra los ocho nuestros (el resto se conserva tal cual al exportar).
export function statusFromSwx(v: unknown): SceneStatus | undefined {
  const s = norm(str(v))
  if (!s || /sin[- ]?estado|none/.test(s)) return undefined
  if (/curso|wip|progress|draft|borrador/.test(s)) return 'draft'
  if (/revis/.test(s)) return 'revision'
  if (/termin|done|final|complete/.test(s)) return 'final'
  return undefined
}
export function statusToSwx(v: SceneStatus | undefined): string {
  if (!v) return ''
  if (v === 'final' || v === 'revised') return 'terminada'
  if (v === 'revision') return 'en-revision'
  return 'en-curso'
}

export function presenceFromSwx(v: unknown): Presence | undefined {
  const s = norm(str(v))
  if (/habla|speak|speaking|dialog/.test(s)) return 'habla'
  if (/mencion|mention/.test(s)) return 'mencion'
  if (/presente|present|appear/.test(s)) return 'presente'
  return undefined
}

// --- Importación: project.json -> archivos del vault -------------------------

const FRONT = (data: Record<string, unknown>) =>
  '---\n' + Object.entries(data).map(([k, v]) => `${k}: ${typeof v === 'string' ? yamlStr(v) : JSON.stringify(v)}`).join('\n') + '\n---\n'

const epCode = (season: unknown, episode: unknown) => `S${String(num(season) || 1).padStart(2, '0')}E${String(num(episode) || 1).padStart(2, '0')}`

export function swxToVault(file: SwxFile, roles: Roles): { files: VaultFile[]; report: ImportReport } {
  const out: VaultFile[] = []
  const projectTitle = str(file.project?.['title'] ?? file.project?.['name'] ?? 'Proyecto SWX')
  const author = str(file.project?.['author'] ?? '')
  const seasons = new Map(arr(file.seasons).map((s) => [str(s['id']), s]))
  const episodes = arr(file.episodes)
  const groups = new Map(arr(file.sceneGroups).map((g) => [str(g['id']), str(g['name'] ?? g['title'] ?? '')]))
  const scenes = arr(file.scenes).slice().sort((a, b) => num(a['order']) - num(b['order']) || num(a['id']) - num(b['id']))

  // Presencia manual por escena: [sceneId][entidad] = habla | presente | mencion
  const names = new Map<string, string>()
  for (const t of ['characters', 'locations', 'items'] as const) for (const e of arr(file[t])) names.set(str(e['id']), str(e['name'] ?? e['title'] ?? ''))
  const presence = new Map<string, Record<string, Presence>>()
  for (const p of arr(file.sceneEntityStatus)) {
    const who = names.get(str(p['entityId'])) || str(p['entityName'])
    const how = presenceFromSwx(p['status'] ?? p['presence'])
    if (!who || !how) continue
    const key = str(p['sceneId'])
    presence.set(key, { ...(presence.get(key) ?? {}), [who]: how })
  }

  // Un guion por episodio (o uno solo si es película).
  const byEpisode = new Map<string, SwxRow[]>()
  for (const sc of scenes) byEpisode.set(str(sc['episodeId'] ?? ''), [...(byEpisode.get(str(sc['episodeId'] ?? '')) ?? []), sc])
  let scriptCount = 0
  let beatCount = 0
  for (const [epId, list] of byEpisode) {
    const ep = episodes.find((e) => str(e['id']) === epId)
    const season = ep ? num(seasons.get(str(ep['seasonId']))?.['number'] ?? seasons.get(str(ep['seasonId']))?.['order'] ?? 1) : 0
    const epNum = ep ? num(ep['number'] ?? ep['order'] ?? 1) : 0
    const epTitle = ep ? str(ep['title'] ?? ep['name'] ?? '') : ''
    const base = ep ? `${epCode(season, epNum)}${epTitle ? ` ${epTitle}` : ''}` : projectTitle
    const name = safeName(base)
    const body: string[] = []
    const meta: Record<string, SceneMeta> = {}
    for (const sc of list) {
      const text = htmlToFountain(str(sc['content']))
      if (!text) continue
      const heading = (text.split('\n')[0] ?? '').trim()
      body.push(text)
      const m: SceneMeta = {}
      const st = statusFromSwx(sc['status'])
      if (st) m.status = st
      if (str(sc['number'])) m.numero = str(sc['number'])
      if (sc['omitted'] === true || sc['omitida'] === true) m.omitida = true
      if (str(sc['summary'] ?? sc['title'])) m.summary = str(sc['summary'] ?? sc['title'])
      const g = groups.get(str(sc['groupId']))
      if (g) m.tags = [safeName(g)]
      const pres = presence.get(str(sc['id']))
      if (pres) m.presencia = pres
      if (Object.keys(m).length) meta[heading] = m
    }
    if (!body.length) continue
    scriptCount++
    const head: Record<string, unknown> = { type: 'script', title: name, status: 'draft', locked: false }
    if (ep) { head['season'] = String(season || 1); head['episode'] = String(epNum || 1) }
    if (author) head['author'] = author
    out.push({ path: `${roles.script}/${name}.md`, content: `${FRONT(head)}\n${body.join('\n\n')}\n` })

    // Escaleta: beats del episodio + metadatos por escena.
    const beats = arr(file.beats).filter((b) => str(b['episodeId'] ?? '') === epId && str(b['kind'] ?? b['lane'] ?? '') !== 'act')
    const acts = arr(file.beats).filter((b) => str(b['episodeId'] ?? '') === epId && str(b['kind'] ?? b['lane'] ?? '') === 'act')
    beatCount += beats.length
    const outline = {
      type: 'outline',
      title: name,
      acts: acts.map((a, i) => ({ title: str(a['title'] ?? `Acto ${i + 1}`), summary: str(a['notes'] ?? a['summary']), from: num(a['sceneIndex'] ?? a['from']), to: num(a['toIndex'] ?? a['to'] ?? a['sceneIndex']) })),
      beats: beats.map((b, i) => ({ id: `swx${i}`, title: str(b['title'] ?? b['name'] ?? `Beat ${i + 1}`), note: str(b['notes'] ?? b['description']), scene: num(b['sceneIndex'] ?? b['scene']), kind: norm(str(b['type'] ?? b['function'])) || 'other' })),
      notes: [],
      sceneMeta: meta
    }
    out.push({ path: `${roles.outline}/${name}.md`, content: `---\n${Object.entries(outline).map(([k, v]) => `${k}: ${typeof v === 'string' ? yamlStr(v) : JSON.stringify(v)}`).join('\n')}\n---\n\n` })
  }

  // Fichas de entidad.
  const entity = (row: SwxRow, kind: 'character' | 'location' | 'prop', dir: string) => {
    const nm = safeName(str(row['name'] ?? row['title']))
    if (!nm) return
    const data: Record<string, unknown> = { type: kind, name: nm }
    const aliases = arr(row['aliases']).map(String).concat(typeof row['aliases'] === 'string' ? str(row['aliases']).split(',').map((x) => x.trim()) : []).filter(Boolean)
    if (aliases.length) data['aliases'] = aliases
    if (str(row['description'])) data['description'] = str(row['description'])
    if (str(row['group'] ?? row['groupName'])) data['group'] = str(row['group'] ?? row['groupName'])
    if (str(row['actor'])) data['actor'] = str(row['actor'])
    if (kind === 'location') {
      if (str(row['address'])) data['region'] = str(row['address'])
      if (str(row['type'])) data['type'] = str(row['type'])
    }
    const notes = str(row['notes'])
    out.push({ path: `${dir}/${nm}.md`, content: `${FRONT(data)}\n${notes}\n` })
  }
  for (const c of arr(file.characters)) entity(c, 'character', roles.character)
  for (const l of arr(file.locations)) entity(l, 'location', roles.location)
  for (const i of arr(file.items)) entity(i, 'prop', roles.prop)

  // Documentos de desarrollo -> conocimiento.
  const docs = arr(file.devDocuments)
  for (const d of docs) {
    const title = safeName(str(d['title'] ?? d['name'] ?? d['type'] ?? 'Documento'))
    const content = str(d['content'] ?? d['text'] ?? '')
    out.push({ path: `${roles.knowledge}/SWX/${title}.md`, content: `${FRONT({ type: 'knowledge', title })}\n${/<p|<div/i.test(content) ? plain(content) : content}\n` })
  }

  const media = arr(file.mediaBlobs).length
  return {
    files: out,
    report: { scripts: scriptCount, scenes: scenes.length, characters: arr(file.characters).length, locations: arr(file.locations).length, items: arr(file.items).length, beats: beatCount, docs: docs.length, media }
  }
}

// --- Exportación: vault -> project.json --------------------------------------

export type ExportScript = { name: string; content: string; season: string; episode: string; sceneMeta: Record<string, SceneMeta> }
export type ExportEntity = { kind: 'character' | 'location' | 'prop'; name: string; content: string }

// Genera el `project.json` que ScriptWriterX importa: escenas en HTML, entidades, temporadas y episodios.
export function vaultToSwx(title: string, author: string, scripts: ExportScript[], entities: ExportEntity[]): string {
  const seasons: SwxRow[] = []
  const episodes: SwxRow[] = []
  const scenes: SwxRow[] = []
  const sceneEntityStatus: SwxRow[] = []
  let sceneId = 1
  const series = scripts.some((s) => s.season || s.episode)
  for (const [i, s] of scripts.entries()) {
    let episodeId: number | null = null
    if (series) {
      const sn = num(s.season) || 1
      if (!seasons.some((x) => x['number'] === sn)) seasons.push({ id: sn, number: sn, title: `Temporada ${sn}` })
      episodeId = i + 1
      episodes.push({ id: episodeId, seasonId: sn, number: num(s.episode) || i + 1, title: s.name, code: epCode(sn, num(s.episode) || i + 1) })
    }
    const doc = parseFountain(s.content)
    const proj = projectScenes(doc)
    const lines = s.content.split('\n')
    for (const [k, sc] of proj.scenes.entries()) {
      const meta = s.sceneMeta[sc.heading] ?? {}
      const body = lines.slice(sc.startLine, sc.endLine).join('\n')
      const id = sceneId++
      scenes.push({
        id, uid: `writter_${id}`, episodeId, order: (k + 1) * 1000,
        number: meta.numero ?? String(k + 1), heading: sc.heading, content: fountainToHtml(body),
        summary: meta.summary ?? '', status: statusToSwx(meta.status), omitted: meta.omitida === true, locked: false
      })
      for (const [who, how] of Object.entries(meta.presencia ?? {})) sceneEntityStatus.push({ sceneId: id, entityName: who, status: how })
    }
  }
  const entityRows = (kind: ExportEntity['kind']) => entities.filter((e) => e.kind === kind).map((e, i) => {
    const { data, body } = readFrontmatter(e.content)
    return { id: i + 1, name: e.name, aliases: Array.isArray(data['aliases']) ? (data['aliases'] as unknown[]).map(String) : [], description: str(data['description']), group: str(data['group']), notes: body.trim() }
  })
  return JSON.stringify({
    format: 'scriptwriterx-project',
    schemaVersion: 41,
    appVersion: 'writter',
    createdAt: new Date().toISOString(),
    _writter: { note: 'Exportado desde Writter: escenas en HTML por bloques, entidades y estructura de serie.' },
    project: { id: 1, title, author, type: series ? 'series' : 'movie', language: 'es' },
    seasons, episodes, scenes, sceneEntityStatus,
    characters: entityRows('character'), locations: entityRows('location'), items: entityRows('prop'),
    sceneGroups: [], beats: [], devDocuments: []
  }, null, 1)
}
