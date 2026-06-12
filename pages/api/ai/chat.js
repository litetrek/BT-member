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

  const { event_id, question, conversation_history = [] } = req.body
  if (!event_id || !question) {
    return res.status(400).json({ error: 'event_id and question are required' })
  }

  const supabase = createServerClient()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Fetch activities first to get their IDs
  const { data: activities } = await supabase
    .from('activities')
    .select('id, name, icon')
    .eq('event_id', event_id)
    .order('sort_order')

  const activityIds = (activities ?? []).map((a) => a.id)

  // Parallel fetch of tasks, log, and announcements
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

  // Build context sections
  const activityMap = Object.fromEntries((activities ?? []).map((a) => [a.id, a.name]))

  const taskLines = tasks.map((t) => {
    const act   = activityMap[t.activity_id] ?? '未知活動'
    const a1    = t.assignee1?.name ?? '—'
    const a2    = t.assignee2?.name
    const who   = a2 ? `${a1}、${a2}` : a1
    const due   = t.due_date ?? '無'
    const desc  = t.description ? `；描述：${t.description.substring(0, 60)}` : ''
    const note  = t.note       ? `；備注：${t.note.substring(0, 60)}`       : ''
    return `[${act}] ${t.title}（${t.status}，負責：${who}，到期：${due}${desc}${note}）`
  }).join('\n')

  const logLines = log.map((e) => {
    const actor  = e.actor?.name ?? '某人'
    const dt     = new Date(e.created_at).toLocaleDateString('zh-TW')
    const detail = e.field_changed
      ? `，${e.field_changed}：${e.old_value ?? ''} → ${e.new_value ?? ''}`
      : e.note ? `，備注：${e.note}` : ''
    return `${dt} ${actor} ${e.action}「${e.entity_name ?? ''}」${detail}`
  }).join('\n')

  const annLines = announcements.map((a) => {
    const dt = new Date(a.created_at).toLocaleDateString('zh-TW')
    return `${dt}：${a.message}`
  }).join('\n')

  const systemPrompt = `你是一位活動管理助理，負責協助團隊負責人了解活動進度。
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

  // Slice history to last 10 and append current question
  const trimmedHistory = conversation_history.slice(-10)
  const messages = [
    ...trimmedHistory,
    { role: 'user', content: question },
  ]

  const response = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 400,
    system:     systemPrompt,
    messages,
  })

  const answer = response.content[0]?.text ?? '抱歉，無法取得回應。'
  const updated_history = [
    ...trimmedHistory,
    { role: 'user',      content: question },
    { role: 'assistant', content: answer },
  ]

  return res.status(200).json({ answer, updated_history })
}
