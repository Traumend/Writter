// Lectura de contenedores de ScriptWriterX (.swx / .swxbackup): ZIP con `project.json` (o `backup.json`).
// Sin dependencias: cabeceras ZIP a mano e `inflateRawSync` de Node para las entradas comprimidas.
import { inflateRawSync } from 'node:zlib'

const EOCD = 0x06054b50
const CEN = 0x02014b50

// Entradas del ZIP (nombre -> contenido). Soporta método 0 (stored) y 8 (deflate).
export function zipEntries(buf: Buffer): Map<string, Buffer> {
  const out = new Map<string, Buffer>()
  let eocd = -1
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) if (buf.readUInt32LE(i) === EOCD) { eocd = i; break }
  if (eocd < 0) return out
  const count = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  for (let n = 0; n < count && p + 46 <= buf.length; n++) {
    if (buf.readUInt32LE(p) !== CEN) break
    const method = buf.readUInt16LE(p + 10)
    const compSize = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const local = buf.readUInt32LE(p + 42)
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen)
    p += 46 + nameLen + extraLen + commentLen
    if (name.endsWith('/')) continue
    const lNameLen = buf.readUInt16LE(local + 26)
    const lExtraLen = buf.readUInt16LE(local + 28)
    const start = local + 30 + lNameLen + lExtraLen
    const raw = buf.subarray(start, start + compSize)
    try {
      out.set(name, method === 8 ? inflateRawSync(raw) : Buffer.from(raw))
    } catch {
      /* entrada ilegible: el resumen de importación la contará como omitida */
    }
  }
  return out
}

export type SwxRead = { kind: 'project'; json: string; media: number } | { kind: 'encrypted' } | { kind: 'invalid' }

// Extrae el JSON del proyecto de un .swx/.swxbackup/.zip/.json. Nunca lanza: el llamador informa al usuario.
export function readSwx(buf: Buffer): SwxRead {
  if (buf.subarray(0, 7).toString('latin1') === 'SWXENC1') return { kind: 'encrypted' }
  const text = buf.subarray(0, 1).toString('utf8')
  if (text === '{') {
    try { JSON.parse(buf.toString('utf8')); return { kind: 'project', json: buf.toString('utf8'), media: 0 } } catch { return { kind: 'invalid' } }
  }
  const entries = zipEntries(buf)
  if (!entries.size) return { kind: 'invalid' }
  const media = [...entries.keys()].filter((k) => k.startsWith('media/')).length
  const main = entries.get('project.json') ?? entries.get('backup.json') ?? [...entries.entries()].find(([k]) => k.endsWith('.json'))?.[1]
  if (!main) return { kind: 'invalid' }
  const json = main.toString('utf8')
  try { JSON.parse(json) } catch { return { kind: 'invalid' } }
  return { kind: 'project', json, media }
}
