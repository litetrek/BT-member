import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).end()
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  if (!['admin', 'lead'].includes(session.user.role)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { event_id, question, conversation_history = [] } = req.body
  if (!event_id || !question) {
    return res.status(400).json({ error: 'event_id and question are required' })
  }

  const lang          = session.user?.preferred_lang ?? 'zh'
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { rows: activities } = await query(
    'SELECT id, name, icon FROM activities WHERE event_id = $1 ORDER BY sort_order',
    [event_id]
  )
  const activityIds = activities.map((a) => a.id)

  const [tasksResult, logResult, announcementsResult] = await Promise.all([
    activityIds.length > 0
      ? query(
          `SELECT t.title, t.status, t.due_date, t.note, t.description, t.activity_id,
             json_build_object('name', u1.name) AS assignee1,
             CASE WHEN t.assignee_2_id IS NOT NULL
               THEN json_build_object('name', u2.name)
               ELSE NULL END AS assignee2
           FROM tasks t
           LEFT JOIN users u1 ON u1.id = t.assignee_1_id
           LEFT JOIN users u2 ON u2.id = t.assignee_2_id
           WHERE t.activity_id = ANY($1)`,
          [activityIds]
        )
      : Promise.resolve({ rows: [] }),

    query(
      `SELECT al.action, al.field_changed, al.old_value, al.new_value, al.note, al.entity_name, al.created_at,
         CASE WHEN al.user_id IS NOT NULL
           THEN json_build_object('name', u.name)
           ELSE NULL END AS actor
       FROM activity_log al
       LEFT JOIN users u ON u.id = al.user_id
       WHERE al.event_id = $1 AND al.created_at >= $2
       ORDER BY al.created_at DESC
       LIMIT 50`,
      [event_id, thirtyDaysAgo]
    ),

    query(
      `SELECT message, created_at FROM announcements
       WHERE event_id = $1 AND created_at >= $2
       ORDER BY created_at DESC LIMIT 20`,
      [event_id, thirtyDaysAgo]
    ),
  ])

  const tasks         = tasksResult.rows ?? []
  const log           = logResult.rows   ?? []
  const announcements = announcementsResult.rows ?? []

  const activityMap = Object.fromEntries(activities.map((a) => [a.id, a.name]))
  const dateLocale  = lang === 'en' ? 'en-US' : 'zh-TW'

  const taskLines = tasks.map((tk) => {
    const act  = activityMap[tk.activity_id] ?? (lang === 'en' ? 'Unknown Activity' : '未知活動')
    const a1   = tk.assignee1?.name ?? '—'
    const a2   = tk.assignee2?.name
    const who  = a2 ? `${a1}, ${a2}` : a1
    const due  = tk.due_date ?? (lang === 'en' ? 'none' : '無')
    const desc = tk.description ? `; desc: ${tk.description.substring(0, 60)}` : ''
    const note = tk.note       ? `; note: ${tk.note.substring(0, 60)}`       : ''
    return `[${act}] ${tk.title} (${tk.status}, assignee: ${who}, due: ${due}${desc}${note})`
  }).join('\n')

  const logLines = log.map((e) => {
    const actor  = e.actor?.name ?? (lang === 'en' ? 'Someone' : '某人')
    const dt     = new Date(e.created_at).toLocaleDateString(dateLocale)
    const detail = e.field_changed
      ? `, ${e.field_changed}: ${e.old_value ?? ''} → ${e.new_value ?? ''}`
      : e.note ? `, note: ${e.note}` : ''
    return `${dt} ${actor} ${e.action} "${e.entity_name ?? ''}"${detail}`
  }).join('\n')

  const annLines = announcements.map((a) => {
    const dt = new Date(a.created_at).toLocaleDateString(dateLocale)
    return `${dt}: ${a.message}`
  }).join('\n')

  const systemPrompt = lang === 'en'
    ? `You are an event management assistant helping team leads understand event progress.
Use the data below to answer questions. Respond in English, concisely (under 150 words).
If a question is outside the available data, say so.

[Activities]
${activities.map((a) => a.name).join(', ') || '(none)'}

[Tasks]
${taskLines || '(none)'}

[Recent Log — 30 days]
${logLines || '(none)'}

[Recent Announcements]
${annLines || '(none)'}`
    : `你是一位活動管理助理，負責協助團隊負責人了解活動進度。
以下是目前活動的完整資料，請根據這些資料回答問題。
回答請使用繁體中文，簡潔清楚，不超過 150 字。
如果問題超出資料範圍，請說明你無法從現有資料中找到答案。

[活動列表]
${activities.map((a) => a.name).join('、') || '（無活動）'}

[任務列表]
${taskLines || '（無任務）'}

[最近30天紀錄]
${logLines || '（無紀錄）'}

[最近公告]
${annLines || '（無公告）'}`

  const trimmedHistory = conversation_history.slice(-10)
  const messages = [
    ...trimmedHistory,
    { role: 'user', content: question },
  ]

  const fallbackError = lang === 'en'
    ? 'Sorry, unable to get a response.'
    : '抱歉，無法取得回應。'

  const response = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 400,
    system:     systemPrompt,
    messages,
  })

  const answer          = response.content[0]?.text ?? fallbackError
  const updated_history = [
    ...trimmedHistory,
    { role: 'user',      content: question },
    { role: 'assistant', content: answer },
  ]

  return res.status(200).json({ answer, updated_history })
}
