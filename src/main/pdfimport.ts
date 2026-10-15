// Extracción de texto de un PDF con geometría (PDF.js en el proceso principal, sin red ni IA).
// La reconstrucción del guion vive en core/import/pdf: aquí solo se leen las páginas.
import { readFileSync } from 'node:fs'
import { pdfToFountain, type PdfItem } from '../core/import/pdf'

type TextItem = { str?: string; transform?: number[]; width?: number }

export async function pdfToScript(file: string): Promise<{ text: string; pages: number }> {
  // Import dinámico: el motor pesa bastante y solo hace falta al importar.
  const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as {
    getDocument: (o: { data: Uint8Array; useWorkerFetch: boolean; isEvalSupported: boolean; useSystemFonts: boolean }) => { promise: Promise<Doc> }
  }
  type Doc = { numPages: number; getPage: (n: number) => Promise<Page> }
  type Page = { getViewport: (o: { scale: number }) => { width: number }; getTextContent: () => Promise<{ items: TextItem[] }> }

  const data = new Uint8Array(readFileSync(file))
  const doc = await pdfjs.getDocument({ data, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise
  const items: PdfItem[] = []
  let width = 612
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    width = page.getViewport({ scale: 1 }).width || width
    const content = await page.getTextContent()
    for (const it of content.items) {
      const str = (it.str ?? '').replace(/\u0000/g, '')
      const tr = it.transform
      if (!str.trim() || !tr) continue
      items.push({ str, x: tr[4] ?? 0, y: tr[5] ?? 0, page: n, w: it.width ?? 0 })
    }
  }
  return { text: pdfToFountain(items, width), pages: doc.numPages }
}
