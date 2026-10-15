import { deflateRawSync } from 'node:zlib'
import { expect, test } from 'vitest'
import { zipStore } from '../../src/core/docx'
import { readSwx, zipEntries } from '../../src/main/swx'

const enc = (s: string) => new TextEncoder().encode(s)

// ZIP con entradas comprimidas (método 8), que es lo que produce JSZip en ScriptWriterX.
// El lector no verifica CRC, así que aquí va en cero.
function zipDeflate(files: { name: string; data: Buffer }[]): Buffer {
  const locals: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8')
    const comp = deflateRawSync(f.data)
    const lh = Buffer.alloc(30)
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8)
    lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(f.data.length, 22); lh.writeUInt16LE(name.length, 26)
    const ch = Buffer.alloc(46)
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(8, 10)
    ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(f.data.length, 24); ch.writeUInt16LE(name.length, 28)
    ch.writeUInt32LE(offset, 42)
    locals.push(lh, name, comp)
    central.push(ch, name)
    offset += lh.length + name.length + comp.length
  }
  const cd = Buffer.concat(central)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(files.length, 8); eocd.writeUInt16LE(files.length, 10)
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, cd, eocd])
}

test('zipEntries lee entradas stored y deflate; readSwx devuelve el project.json', () => {
  const json = JSON.stringify({ project: { title: 'La Azotea' }, scenes: [] })
  const stored = Buffer.from(zipStore([{ name: 'project.json', data: enc(json) }, { name: 'media/foto.jpg', data: enc('bin') }]))
  expect([...zipEntries(stored).keys()].sort()).toEqual(['media/foto.jpg', 'project.json'])
  expect(readSwx(stored)).toMatchObject({ kind: 'project', media: 1 })

  // JSON grande de verdad (comprimible) para ejercitar el inflado.
  const big = JSON.stringify({ project: { title: 'La Azotea' }, scenes: Array.from({ length: 200 }, (_, i) => ({ id: i, content: '<p class="action">Ana apaga la luz.</p>' })) })
  const packed = zipDeflate([{ name: 'project.json', data: Buffer.from(big, 'utf8') }, { name: 'media/a.png', data: Buffer.from('x') }])
  const entries = zipEntries(packed)
  expect(entries.get('project.json')!.toString('utf8')).toBe(big)
  const read = readSwx(packed)
  expect(read.kind).toBe('project')
  if (read.kind === 'project') {
    expect(JSON.parse(read.json).project.title).toBe('La Azotea')
    expect(read.media).toBe(1)
  }
})

test('readSwx acepta JSON suelto, backup.json y detecta cifrados o ilegibles', () => {
  expect(readSwx(Buffer.from('{"project":{"title":"X"},"scenes":[]}', 'utf8'))).toMatchObject({ kind: 'project', media: 0 })
  expect(readSwx(Buffer.from(zipStore([{ name: 'backup.json', data: enc('{"projects":[]}') }]))).kind).toBe('project')
  expect(readSwx(Buffer.concat([Buffer.from('SWXENC1'), Buffer.from([1, 2, 3])])).kind).toBe('encrypted')
  expect(readSwx(Buffer.from('no soy un zip', 'utf8')).kind).toBe('invalid')
  expect(readSwx(Buffer.from('{ roto', 'utf8')).kind).toBe('invalid')
  expect(readSwx(Buffer.from(zipStore([{ name: 'a.txt', data: enc('hola') }]))).kind).toBe('invalid')
})
