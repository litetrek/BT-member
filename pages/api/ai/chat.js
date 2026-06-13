import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
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

  const { event_id, question, conversation_history = [], lang: bodyLang } = req.body
  if (!event_id || !question) {
    return res.status(400).json({ error: 'event_id and question are required' })
  }

  // Accept lang from request body; fallback to session, then 'zh'
  const lang = (bodyLang === 'en' || bodyLang === 'zh') ? bodyLang : (session.user?.lang ?? 'zh')

  const supabase = createServerClient()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: activities } = await supabase
    .from('activities')
    .select('id, name, icon')
    .eq('event_id', event_id)
    .order('sort_order')

  const activityIds = (activities ?? []).map((a) => a.id)

  const [tasksResult, logResult, announcementsResult] = await Promise.all([
    activityIds.length > 0
      ? supabase
          .from('tasks')
          .select('title, status, due_date, note, description, activity_id, assignee1:assignee_1_id(name), assignee2:assignee_2_id(name)')
          .in('activity_id', activityIds)
      : Promise.resolve({ data: [] }),

    supabase
      .from('activity_log')
      .select('action, field_changed, old_value, new_value, note, entity_name, created_at, actor:user_id(name)')
      .eq('event_id', event_id)
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(50),

    supabase
      .from('announcements')
      .select('message, created_at')
      .eq('event_id', event_id)
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const tasks         = tasksResult.data ?? []
  const log           = logResult.data ?? []
  const announcements = announcementsResult.data ?? []

  const activityMap = Object.fromEntries((activities ?? []).map((a) => [a.id, a.name]))

  const dateLocale = lang === 'en' ? 'en-US' : 'zh-TW'

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
${(activities ?? []).map((a) => a.name).join(', ') || '(none)'}

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
${(activities ?? []).map((a) => a.name).join('、') || '（無活動）'}

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

  const answer = response.content[0]?.text ?? fallbackError
  const updated_history = [
    ...trimmedHistory,
    { role: 'user',      content: question },
    { role: 'assistant', content: answer },
  ]

  return res.status(200).json({ answer, updated_history })
}
