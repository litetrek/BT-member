// Parsing for the unified import (WhatsApp exports and pasted SMS text).
// Runs in the browser (the zip is unpacked there, because exports with media are
// larger than Vercel's upload limit) and in tests under Node.
//
// Supported WhatsApp line shapes (dates vary by phone language/region):
//   iPhone:  [9/4/26, 7:30:03 PM] Name: text          [04/09/2026, 19:30:03] Name: text
//   Android: 9/4/26, 7:30 PM - Name: text              04/09/2026, 19:30 - Name: text
//   Chinese: [2026/9/4 下午7:30:03] Name: text          2026/9/4 下午7:30 - Name: text
// Lines without a header belong to the previous message (multi-line messages).
// Header lines with no "Name:" are system notices (encryption, group changes) and are skipped.

const INVISIBLE = /[‎‏‪-‮⁦-⁩﻿]/g
const SPACES = /[  ]/g

// [date, time] or date, time -   — captures: date, time, rest
const HEADER_RE = /^\[?(\d{1,4}[\/.\-]\d{1,2}[\/.\-]\d{1,4}),?\s+((?:上午|下午|AM|PM|am|pm)?\s?\d{1,2}:\d{2}(?::\d{2})?(?:\s?(?:AM|PM|am|pm|a\.m\.|p\.m\.|上午|下午))?)\]?\s*(?:-\s)?(.*)$/

// iPhone: "<attached: 00000085-PHOTO-2026-09-25-16-25-37.jpg>"
// Android: "IMG-20260925-WA0001.jpg (file attached)"  /  "IMG-20260925-WA0001.jpg (附件)"
const ATTACH_RES = [
  /<(?:attached|附件)[:：]\s*([^>]+)>/i,
  /^(\S+\.(?:jpe?g|png|webp|heic|gif|mp4|mov|3gp|opus|ogg|m4a|mp3|pdf|docx?|xlsx?|vcf))\s*\((?:file attached|附件|已附加檔案|檔案已附加)\)/i,
]
const OMITTED_RE = /^<?(?:media omitted|image omitted|video omitted|audio omitted|sticker omitted|GIF omitted|document omitted|已略過媒體|圖片已略過|影片已略過|音訊已略過)>?$/i

export const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif|heic)$/i

function clean(s) {
  return String(s).replace(INVISIBLE, '').replace(SPACES, ' ')
}

function splitDate(d) {
  return d.split(/[\/.\-]/).map((n) => parseInt(n, 10))
}

// Decides the order of date parts for the whole file: Y/M/D, M/D/Y or D/M/Y.
// Ambiguous files (every part ≤ 12) default to M/D/Y, the US iPhone/Android format.
export function detectDateOrder(dateStrings) {
  let firstOver12 = false, secondOver12 = false, yearFirst = false
  for (const d of dateStrings) {
    const [a, b] = splitDate(d)
    if (String(d).match(/^\d{4}/)) yearFirst = true
    if (a > 12) firstOver12 = true
    if (b > 12) secondOver12 = true
  }
  if (yearFirst) return 'YMD'
  if (firstOver12 && !secondOver12) return 'DMY'
  return 'MDY'
}

function toParts(dateStr, order) {
  const p = splitDate(dateStr)
  let y, m, d
  if (order === 'YMD') [y, m, d] = p
  else if (order === 'DMY') [d, m, y] = p
  else [m, d, y] = p
  if (y < 100) y += 2000
  return { y, m, d }
}

function parseTime(t) {
  const s = t.trim()
  const pm = /(PM|pm|p\.m\.|下午)/.test(s)
  const am = /(AM|am|a\.m\.|上午)/.test(s)
  const [hh, mm, ss = '0'] = s.replace(/[^\d:]/g, '').split(':')
  let h = parseInt(hh, 10)
  if (pm && h < 12) h += 12
  if (am && h === 12) h = 0
  return { h, mi: parseInt(mm, 10), s: parseInt(ss, 10) }
}

const pad = (n) => String(n).padStart(2, '0')

// Local wall-clock time as written in the chat, e.g. '2026-09-04T19:30:03'.
function localStamp({ y, m, d }, { h, mi, s }) {
  return `${y}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(mi)}:${pad(s)}`
}

function findAttachment(text) {
  for (const re of ATTACH_RES) {
    const m = text.match(re)
    if (m) return m[1].trim()
  }
  return null
}

// Returns { messages, format, dateOrder, skippedSystem }.
// Each message: { index, at: 'YYYY-MM-DDTHH:mm:ss' (local), sender, text, attachment?, omittedMedia? }
export function parseWhatsApp(raw) {
  const rawLines = String(raw).replace(/\r\n?/g, '\n').split('\n')
  const lines = rawLines.map(clean)

  // Pass 1: find header lines and decide the date order for the whole file.
  const heads = lines.map((l) => l.match(HEADER_RE))
  const order = detectDateOrder(heads.filter(Boolean).map((m) => m[1]))

  const messages = []
  let skippedSystem = 0
  let current = null

  for (let i = 0; i < lines.length; i++) {
    const h = heads[i]
    if (h) {
      const rest = h[3]
      const colon = rest.indexOf(': ')
      // A system notice has no "Name: " (or the colon sits too far in to be a name).
      if (colon <= 0 || colon > 60) {
        skippedSystem++
        current = null
        continue
      }
      const sender = rest.slice(0, colon).trim()
      const text = rest.slice(colon + 2)
      // iPhone posts notices (encryption, "X added Y", group renamed) under the group's
      // name with an invisible left-to-right mark before the text; real attachments use
      // the same mark, so only skip when it isn't an attachment.
      if (/: \u200e/.test(rawLines[i]) && !/<(?:attached|附件)[:：]/i.test(rawLines[i]) && !OMITTED_RE.test(text.trim())) {
        skippedSystem++
        current = null
        continue
      }
      const at = localStamp(toParts(h[1], order), parseTime(h[2]))
      current = { index: messages.length, at, sender, text }
      messages.push(current)
    } else if (current && lines[i] !== '') {
      current.text += '\n' + lines[i]
    } else if (current && lines[i] === '') {
      current.text += '\n'
    }
  }

  for (const m of messages) {
    m.text = m.text.replace(/\n+$/, '')
    const attachment = findAttachment(m.text)
    if (attachment) {
      m.attachment = attachment
      m.text = m.text.replace(ATTACH_RES[0], '').replace(ATTACH_RES[1], '').trim()
    } else if (OMITTED_RE.test(m.text.trim())) {
      m.omittedMedia = true
      m.text = ''
    }
  }

  return {
    messages,
    format: messages.length ? 'whatsapp' : 'unknown',
    dateOrder: order,
    skippedSystem,
  }
}

// Pasted text (SMS etc.): tries WhatsApp-style lines first; otherwise the whole paste
// becomes one message from `fallbackSender`, dated now. The AI handles free text.
export function parsePastedText(raw, fallbackSender = '貼上的文字', now = new Date()) {
  const parsed = parseWhatsApp(raw)
  if (parsed.messages.length >= 2) return { ...parsed, format: 'pasted-chat' }
  const text = clean(raw).trim()
  if (!text) return { messages: [], format: 'empty', dateOrder: null, skippedSystem: 0 }
  const at = localStamp(
    { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() },
    { h: now.getHours(), mi: now.getMinutes(), s: now.getSeconds() }
  )
  return {
    messages: [{ index: 0, at, sender: fallbackSender, text }],
    format: 'pasted-text',
    dateOrder: null,
    skippedSystem: 0,
  }
}

// Stable key per message for skipping already-imported messages on re-import.
export async function messageKey(m) {
  const input = `${m.at}|${m.sender}|${m.attachment ?? ''}|${m.text}`
  const bytes = new TextEncoder().encode(input)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest).slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function withKeys(messages) {
  return Promise.all(messages.map(async (m) => ({ ...m, key: await messageKey(m) })))
}

// Transcript handed to the AI: one numbered line per message.
export function toTranscript(messages) {
  return messages
    .map((m) => {
      const body = [m.text, m.attachment && IMAGE_EXT_RE.test(m.attachment) ? `[照片 #${m.index}]` : m.attachment ? '[附件]' : '', m.omittedMedia ? '[媒體]' : '']
        .filter(Boolean).join(' ')
      return `#${m.index} ${m.at.replace('T', ' ').slice(0, 16)} ${m.sender}: ${body.replace(/\n/g, ' / ')}`
    })
    .join('\n')
}

// Splits messages into AI-sized chunks without breaking up a burst of related lines.
export function chunkMessages(messages, maxChars = 12000) {
  const chunks = []
  let cur = [], size = 0
  for (const m of messages) {
    const len = (m.text?.length ?? 0) + 60
    if (cur.length && size + len > maxChars) { chunks.push(cur); cur = []; size = 0 }
    cur.push(m); size += len
  }
  if (cur.length) chunks.push(cur)
  return chunks
}

// Best-effort match of a chat display name to a member, by name or email prefix.
export function guessMember(sender, members) {
  const norm = (s) => String(s ?? '').toLowerCase().replace(/[\s._\-()（）]/g, '')
  const s = norm(sender)
  if (!s) return null
  let best = null
  for (const u of members) {
    const n = norm(u.name)
    const e = norm(String(u.email ?? '').split('@')[0])
    if (n && n === s) return u.id
    if (!best && ((n && (n.includes(s) || s.includes(n)) && Math.min(n.length, s.length) >= 2) || (e && e === s))) best = u.id
  }
  return best
}
