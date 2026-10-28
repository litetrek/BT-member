import Anthropic from '@anthropic-ai/sdk'
import { query } from '@/lib/db'
import { importGuard } from '@/lib/importApi'
import { buildSystemPrompt, buildUserPrompt, extractJson, sanitizeAnalysis } from '@/lib/importAnalysis'

// POST /api/import/analyze { event_id, messages: [{ index, at, sender, text, attachment? }] }
// → { status_updates, tasks, photos }   (one chunk; the page sends chunks one by one)
// Nothing is saved here — the coordinator reviews the proposal first.
export const config = {
  api: { bodyParser: { sizeLimit: '2mb' } },
  maxDuration: 60,
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).end()
  }
  const ctx = await importGuard(req, res, req.body?.event_id)
  if (!ctx) return

  const messages = (Array.isArray(req.body?.messages) ? req.body.messages : [])
    .filter((m) => m && Number.isInteger(m.index) && typeof m.at === 'string' && typeof m.sender === 'string')
    .slice(0, 800)
    .map((m) => ({
      index: m.index,
      at: m.at.slice(0, 19),
      sender: m.sender.slice(0, 100),
      text: String(m.text ?? '').slice(0, 4000),
      attachment: typeof m.attachment === 'string' ? m.attachment.slice(0, 200) : undefined,
      omittedMedia: !!m.omittedMedia,
    }))
  if (!messages.length) return res.status(400).json({ error: '沒有可分析的訊息' })

  const { rows: activities } = await query(
    'SELECT id, name FROM activities WHERE event_id = $1 ORDER BY sort_order',
    [ctx.event.id]
  )
  const people = [...new Set(messages.map((m) => m.sender))]

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 6000,
      system: buildSystemPrompt({ event: ctx.event, activities, people }),
      messages: [{ role: 'user', content: buildUserPrompt(messages) }],
    })
    const text = response.content.map((c) => (c.type === 'text' ? c.text : '')).join('')
    const parsed = extractJson(text)
    if (!parsed) {
      console.error('[import analyze] unparseable answer, stop_reason=', response.stop_reason)
      return res.status(502).json({ error: 'AI 回應格式有誤，請重試' })
    }
    const result = sanitizeAnalysis(parsed, { messages, activityIds: new Set(activities.map((a) => a.id)) })
    return res.status(200).json({ ...result, truncated: response.stop_reason === 'max_tokens' })
  } catch (err) {
    console.error('[import analyze]', err.status ?? '', err.message)
    return res.status(502).json({ error: 'AI 分析失敗，請稍後再試' })
  }
}
