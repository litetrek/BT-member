import Anthropic from '@anthropic-ai/sdk'
import { query } from '@/lib/db'
import { importGuard } from '@/lib/importApi'
import { extractJson } from '@/lib/importAnalysis'
import { buildDocSystemPrompt, sanitizeDocAnalysis, isOurBlobUrl } from '@/lib/docAnalysis'

// POST /api/import/analyze-doc
//   { event_id, doc: { name, url, type: 'docx'|'xlsx'|'text'|'pdf'|'image', text? } }
// → { doc_kind, summary, activity_id, new_activities, tasks, status_updates }
// Word/Excel/text arrive as extracted text; PDFs and photos are read by the model from
// the uploaded file. Nothing is saved here.
export const config = {
  api: { bodyParser: { sizeLimit: '1mb' } },
  maxDuration: 60,
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const IMAGE_TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).end()
  }
  const ctx = await importGuard(req, res, req.body?.event_id)
  if (!ctx) return

  const doc = req.body?.doc ?? {}
  const name = String(doc.name ?? '文件').slice(0, 200)
  const type = String(doc.type ?? '')
  const text = typeof doc.text === 'string' ? doc.text.slice(0, 60000) : ''

  let content
  if (['docx', 'xlsx', 'text'].includes(type)) {
    if (!text.trim()) return res.status(400).json({ error: '文件沒有文字內容' })
    content = [{ type: 'text', text: `文件內容：\n${text}` }]
  } else if (type === 'pdf' || type === 'image') {
    if (!isOurBlobUrl(doc.url)) return res.status(400).json({ error: '檔案網址無效' })
    content = type === 'pdf'
      ? [{ type: 'document', source: { type: 'url', url: doc.url } }]
      : [{ type: 'image', source: { type: 'url', url: doc.url } }]
    content.push({ type: 'text', text: '請整理上面這份文件。' })
  } else {
    return res.status(400).json({ error: '不支援的檔案類型' })
  }

  const [{ rows: activities }, { rows: members }] = await Promise.all([
    query('SELECT id, name FROM activities WHERE event_id = $1 ORDER BY sort_order', [ctx.event.id]),
    query(
      `SELECT u.name FROM event_members m JOIN users u ON u.id = m.user_id
       WHERE m.event_id = $1 AND u.name IS NOT NULL`,
      [ctx.event.id]
    ),
  ])

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 6000,
      system: buildDocSystemPrompt({ event: ctx.event, activities, people: members.map((m) => m.name), docName: name }),
      messages: [{ role: 'user', content }],
    })
    const answer = response.content.map((c) => (c.type === 'text' ? c.text : '')).join('')
    const parsed = extractJson(answer)
    if (!parsed) {
      console.error('[import analyze-doc] unparseable answer, stop_reason=', response.stop_reason)
      return res.status(502).json({ error: 'AI 回應格式有誤，請重試' })
    }
    return res.status(200).json({
      ...sanitizeDocAnalysis(parsed, { activities }),
      truncated: response.stop_reason === 'max_tokens',
    })
  } catch (err) {
    console.error('[import analyze-doc]', err.status ?? '', err.message)
    const tooBig = err.status === 400 && /too (large|long)|page|size/i.test(err.message)
    return res.status(502).json({ error: tooBig ? '文件太大，AI 無法讀取。請分成幾個較小的檔案。' : 'AI 分析失敗，請稍後再試' })
  }
}
