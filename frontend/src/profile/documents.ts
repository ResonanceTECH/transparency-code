// Предпросмотр настоящих синтетических PDF и учёт загруженных файлов.
import { documents } from './data'

const urls = new Map<string, string>()
const SAMPLE_FILES = new Set<string>([
  ...documents.map(([name]) => name),
  'Решение_региональная_поддержка_демо.pdf',
  'Подтверждающий_документ_результата.pdf'
])

function pdfEscape(value: string): string {
  return value
    .replace(/[^\x20-\x7e]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

function demoPdf(name: string): Blob {
  const title = pdfEscape(name)
  const stream = `BT /F1 16 Tf 72 740 Td (RESONANCE - synthetic document) Tj /F1 11 Tf 0 -28 Td (${title}) Tj 0 -22 Td (All data is fictional. Not an official document.) Tj ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  ]
  let body = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((object, index) => {
    offsets.push(body.length)
    body += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = body.length
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  offsets.forEach((offset) => {
    body += `${String(offset).padStart(10, '0')} 00000 n \n`
  })
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return new Blob([body], { type: 'application/pdf' })
}

export function registerFile(file: File): string {
  const url = URL.createObjectURL(file)
  const previous = urls.get(file.name)
  if (previous) URL.revokeObjectURL(previous)
  urls.set(file.name, url)
  return url
}

export function documentUrl(name: string): string {
  const existing = urls.get(name)
  if (existing) return existing
  if (SAMPLE_FILES.has(name)) return `/samples/${encodeURIComponent(name)}`
  const url = URL.createObjectURL(demoPdf(name))
  urls.set(name, url)
  return url
}
