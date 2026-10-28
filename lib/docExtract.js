// Document handling for the import page (browser) plus pure helpers used by tests.
//
// What happens per file type:
//   .docx            → text in the browser (mammoth → simple HTML → plain text with
//                      headings, lists and table rows kept), so Weiya-style plans keep
//                      their structure for the AI
//   .xlsx            → each sheet as "a | b | c" rows (read-excel-file)
//   .csv .txt .md    → as-is
//   .pdf             → not extracted here; the AI reads the PDF itself (incl. scans/tables)
//   photos           → resized in the browser; the AI reads the image (handwriting, whiteboards)
//   .doc .xls .ppt   → old Office formats: ask to re-save as .docx / .xlsx / PDF

export const MAX_DOC_BYTES = 25 * 1024 * 1024
export const MAX_TEXT_CHARS = 60000

const EXT = (name) => (String(name).toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '')

export function docTypeOf(name, mime = '') {
  const ext = EXT(name)
  if (ext === 'docx') return 'docx'
  if (ext === 'xlsx' || ext === 'xlsm') return 'xlsx'
  if (['csv', 'txt', 'md', 'tsv'].includes(ext)) return 'text'
  if (ext === 'pdf' || mime === 'application/pdf') return 'pdf'
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) || /^image\/(jpeg|png|webp|gif)$/.test(mime)) return 'image'
  if (['heic', 'heif'].includes(ext)) return 'heic'
  if (['doc', 'xls', 'ppt', 'pptx', 'pages', 'numbers', 'key'].includes(ext)) return 'old-office'
  return 'unknown'
}

export const ACCEPT_ATTR = '.docx,.xlsx,.xlsm,.csv,.txt,.md,.pdf,.jpg,.jpeg,.png,.webp,.heic'

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" }

// mammoth's HTML is small and well-formed, so a tag-level conversion is enough.
export function htmlToText(html) {
  let s = String(html)
  // Word puts a paragraph inside every table cell; keep each row on one line.
  s = s.replace(/<(t[dh])([^>]*)>([\s\S]*?)<\/\1>/gi, (_, tag, attrs, inner) =>
    `<${tag}${attrs}>${inner.replace(/<\/p>\s*<p[^>]*>/gi, '；').replace(/<br\s*\/?>/gi, ' ').replace(/<\/?p[^>]*>/gi, '')}</${tag}>`)
  s = s.replace(/<h([1-6])[^>]*>/gi, (_, n) => `\n\n${'#'.repeat(Number(n))} `)
  s = s.replace(/<\/h[1-6]>/gi, '\n')
  s = s.replace(/<li[^>]*>/gi, '\n- ')
  s = s.replace(/<tr[^>]*>/gi, '\n| ')
  s = s.replace(/<\/t[dh]>/gi, ' | ')
  s = s.replace(/<\/table>/gi, '\n')
  s = s.replace(/<br\s*\/?>/gi, '\n')
  s = s.replace(/<\/p>/gi, '\n')
  s = s.replace(/<img[^>]*>/gi, '[圖片]')
  s = s.replace(/<[^>]+>/g, '')
  s = s.replace(/&(#?\w+);/g, (m, e) => ENTITIES[e] ?? (e.startsWith('#') ? String.fromCodePoint(Number(e.slice(1))) : m))
  s = s.replace(/[ \t]+\n/g, '\n').replace(/\| +\|/g, '| |').replace(/\n{3,}/g, '\n\n')
  return s.trim()
}

export function rowsToText(sheets) {
  const parts = []
  for (const { sheet, data } of sheets) {
    const rows = (data ?? [])
      .map((r) => r.map((c) => (c instanceof Date ? c.toISOString().slice(0, 10) : c ?? '')).map((c) => String(c).trim()))
      .filter((r) => r.some(Boolean))
      .slice(0, 3000)
      .map((r) => r.join(' | '))
    if (rows.length) parts.push(`## ${sheet}\n${rows.join('\n')}`)
  }
  return parts.join('\n\n')
}

export function capText(text, max = MAX_TEXT_CHARS) {
  const s = String(text ?? '')
  return s.length > max ? { text: s.slice(0, max), truncated: true } : { text: s, truncated: false }
}

async function sha256Hex(buffer) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest).slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('')
}

// Browser only. Returns { type, key, text?, truncated?, uploadBlob, uploadName, uploadMime }.
// Throws an Error with a Chinese message the page can show as-is.
export async function prepareDocument(file) {
  const type = docTypeOf(file.name, file.type)
  if (type === 'old-office') throw new Error(`「${file.name}」是舊版 Office 格式，請另存為 .docx、.xlsx 或 PDF 後再上傳。`)
  if (type === 'heic') throw new Error(`「${file.name}」是 HEIC 照片，請在手機上改用 JPEG（或截圖）後再上傳。`)
  if (type === 'unknown') throw new Error(`不支援「${file.name}」這種檔案。可上傳 Word、Excel、CSV、PDF 或照片。`)
  if (file.size > MAX_DOC_BYTES) throw new Error(`「${file.name}」超過 25 MB，請壓縮或分成幾個檔案。`)

  const buffer = await file.arrayBuffer()
  const key = await sha256Hex(buffer)
  const base = { type, key, uploadBlob: file, uploadName: file.name, uploadMime: file.type || 'application/octet-stream' }

  if (type === 'docx') {
    const mammoth = (await import('mammoth/mammoth.browser.min.js')).default ?? (await import('mammoth/mammoth.browser.min.js'))
    const { value } = await mammoth.convertToHtml({ arrayBuffer: buffer })
    const { text, truncated } = capText(htmlToText(value))
    if (!text.trim()) throw new Error(`「${file.name}」裡沒有可讀的文字。如果是掃描檔，請另存為 PDF 後上傳。`)
    return { ...base, text, truncated }
  }
  if (type === 'xlsx') {
    const { default: readXlsxFile } = await import('read-excel-file/browser')
    const sheets = await readXlsxFile(file)
    const { text, truncated } = capText(rowsToText(sheets))
    return { ...base, text, truncated }
  }
  if (type === 'text') {
    const { text, truncated } = capText(new TextDecoder().decode(buffer))
    return { ...base, text, truncated }
  }
  if (type === 'image') {
    // Photos of lists/whiteboards: shrink before upload (the AI's image limit is 5 MB).
    const { resizeForUpload } = await import('./inventoryPhoto')
    const { full } = await resizeForUpload(file)
    return { ...base, uploadBlob: full, uploadName: file.name.replace(/\.[a-z0-9]+$/i, '') + '.jpg', uploadMime: 'image/jpeg' }
  }
  return base // pdf
}

// Browser only: uploads straight to Vercel Blob (bypasses the 4.5 MB API body limit).
export async function uploadDocument(prepared, eventId) {
  const { upload } = await import('@vercel/blob/client')
  const safe = prepared.uploadName.replace(/[^\w.\-一-鿿]+/g, '_').slice(-80)
  const blob = await upload(`events/${eventId}/docs/${safe}`, prepared.uploadBlob, {
    access: 'public',
    handleUploadUrl: '/api/import/upload-token',
    clientPayload: JSON.stringify({ event_id: eventId }),
    contentType: prepared.uploadMime,
  })
  return blob.url
}
