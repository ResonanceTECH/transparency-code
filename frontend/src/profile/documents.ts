import manifest from 'virtual:resonance-document-samples'
import type { Attachment } from './types'

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024
export const CONSENT_SAMPLE = 'Согласие_ПДн_учебный.pdf'
export const SUPPORT_SAMPLE = 'Решение_региональная_поддержка_демо.pdf'

export function sampleAttachment(name: string, section: string, kind: Attachment['kind'] = 'basis'): Attachment {
  const file = manifest.documents.find((item) => item.name === name)
  if (!file) throw new Error('Учебный файл не найден в манифесте')
  return {
    id: crypto.randomUUID(), name, url: `/samples/${encodeURIComponent(name)}`,
    size: file.size, format: 'pdf', section, kind, origin: 'sample'
  }
}

// Техническая проверка контейнера, а не оценка содержания, подлинности или подписи.
// Файл с корректной сигнатурой всё ещё может быть плохо отсканирован или повреждён.
export async function checkFile(file: File, mode: 'basis' | 'scan' | 'photo' = 'basis'): Promise<string | undefined> {
  if (!file.size) return 'Файл пуст. Выберите документ с содержимым.'
  if (file.size > MAX_DOCUMENT_BYTES) return 'Файл больше 5 МБ. Уменьшите размер или выберите другой файл.'
  const extension = file.name.split('.').pop()?.toLowerCase() || ''
  const allowed = mode === 'photo' ? ['png', 'jpg', 'jpeg'] : mode === 'scan' ? ['pdf', 'png', 'jpg', 'jpeg'] : ['pdf', 'docx']
  if (!allowed.includes(extension)) return `Недопустимый формат. Разрешены: ${allowed.join(', ').toUpperCase()}.`
  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const text = new TextDecoder('latin1').decode(bytes)
    const isPdf = /^%PDF-\d\.\d/.test(text.slice(0, 12)) && text.slice(-1024).includes('%%EOF')
    const isDocx = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 3 && bytes[3] === 4
      && text.includes('[Content_Types].xml') && text.includes('word/document.xml')
    const isPng = [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9
    if (!(extension === 'pdf' ? isPdf : extension === 'docx' ? isDocx : extension === 'png' ? isPng : isJpeg)) {
      return 'Содержимое не соответствует формату файла. Сохраните документ заново; одного переименования недостаточно.'
    }
    if (mode === 'photo' || ['png', 'jpg', 'jpeg'].includes(extension)) {
      const image = await createImageBitmap(file)
      image.close()
    }
  } catch {
    return 'Не удалось прочитать файл. Попробуйте другой документ или сохраните его заново.'
  }
  return undefined
}

export function uploadedAttachment(file: File, section: string, kind: Attachment['kind'] = 'basis'): Attachment {
  return {
    id: crypto.randomUUID(), name: file.name, url: URL.createObjectURL(file), size: file.size,
    format: file.name.split('.').pop()?.toLowerCase() || '', section, kind, origin: 'upload'
  }
}
