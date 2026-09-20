import { parseFountain, type Token } from '../parser/fountain'

// Exportación DOCX (Word) sin dependencias: OOXML mínimo empaquetado en un ZIP "stored" (sin compresión).
// Word abre ZIPs stored sin problema. Estructura de guion preservada (AC-3), tipografía fina no.

const enc = new TextEncoder()

// CRC-32 (necesario para las cabeceras ZIP).
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// ZIP con método 0 (stored). Devuelve el archivo completo como Uint8Array.
export function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const chunks: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  const u16 = (n: number) => new Uint8Array([n & 0xff, (n >>> 8) & 0xff])
  const u32 = (n: number) => new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff])
  const cat = (arrs: Uint8Array[]) => {
    const total = arrs.reduce((a, b) => a + b.length, 0)
    const out = new Uint8Array(total)
    let o = 0
    for (const a of arrs) { out.set(a, o); o += a.length }
    return out
  }
  for (const f of files) {
    const name = enc.encode(f.name)
    const crc = crc32(f.data)
    const local = cat([u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(f.data.length), u32(f.data.length), u16(name.length), u16(0), name, f.data])
    chunks.push(local)
    central.push(cat([u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(f.data.length), u32(f.data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]))
    offset += local.length
  }
  const cd = cat(central)
  const end = cat([u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cd.length), u32(offset), u16(0)])
  return cat([...chunks, cd, end])
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Sangrías estilo guion en twips (1 pulgada = 1440).
const IND: Partial<Record<Token['type'], { left?: number; right?: number; jc?: string; bold?: boolean }>> = {
  heading: { bold: true },
  action: {},
  character: { left: 3168 },
  parenthetical: { left: 2304 },
  dialogue: { left: 1440, right: 2160 },
  transition: { jc: 'right' },
  centered: { jc: 'center' }
}

function paragraph(t: Token): string {
  const cfg = IND[t.type]
  if (!cfg) return ''
  const text = esc(t.text.trim().replace(/^[.@!>]/, '').replace(/<$/, ''))
  const ind = cfg.left || cfg.right ? `<w:ind${cfg.left ? ` w:left="${cfg.left}"` : ''}${cfg.right ? ` w:right="${cfg.right}"` : ''}/>` : ''
  const jc = cfg.jc ? `<w:jc w:val="${cfg.jc}"/>` : ''
  const pPr = `<w:pPr>${ind}${jc}<w:spacing w:before="120" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>`
  const rPr = `<w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:sz w:val="24"/>${cfg.bold ? '<w:b/>' : ''}</w:rPr>`
  return `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${text}</w:t></w:r></w:p>`
}

export function mdToDocx(md: string): Uint8Array {
  const { tokens } = parseFountain(md)
  const body = tokens.map(paragraph).filter(Boolean).join('')
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="2160"/></w:sectPr></w:body></w:document>`
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
  return zipStore([
    { name: '[Content_Types].xml', data: enc.encode(contentTypes) },
    { name: '_rels/.rels', data: enc.encode(rels) },
    { name: 'word/document.xml', data: enc.encode(document) }
  ])
}
