import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function timeAgo(ts, lang) {
  const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000)
  if (lang === 'en') {
    if (mins < 60)   return `${mins} min ago`
    if (mins < 1440) return `${Math.round(mins / 60)} hrs ago`
    return `${Math.round(mins / 1440)} days ago`
  }
  if (mins < 60)   return `${mins} 分鐘前`
  if (mins < 1440) return `${Math.round(mins / 60)} 小時前`
  return `${Math.round(mins / 1440)} 天前`
}

function formatLine(entry, lang) {
  const actor = entry.actor?.name ?? (lang === 'en' ? 'Someone' : '某人')
  const name  = entry.entity_name ? `'${entry.entity_name}'` : entry.entity_type
  const when  = timeAgo(entry.created_at, lang)

  switch (entry.action) {
    case 'status_changed':
      return `${actor} changed ${entry.entity_type} ${name} status: ${entry.old_value} → ${entry.new_value} — ${when}`
    case 'note_added':
      return `${actor} added note to ${name}: ${entry.note} — ${when}`
    case 'created':
      return `${actor} created ${entry.entity_type} ${name} — ${when}`
    case 'deleted':
      return `${actor} deleted ${entry.entity_type} ${name} — ${when}`
    case 'updated': {
      const field = entry.field_changed ? ` (${entry.field_changed}: ${entry.old_value} → ${entry.new_value})` : ''
      return `${actor} updated ${entry.entity_type} ${name}${field} — ${when}`
    }
    default:
      return `${actor} ${entry.action} ${entry.entity_type} ${name} — ${when}`
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).end()
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  if (!['admin', 'lead'].includes(session.user?.role)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { event_id, hours = '24' } = req.query
  const lang = session.user?.preferred_lang ?? 'zh'

  if (!event_id) return res.status(400).json({ error: 'event_id required' })

  const supabase = createServerClient()
  const cutoff = new Date(Date.now() - Number(hours) * 3600 * 1000)

  const { data: logs, error } = await supabase
    .from('activity_log')
    .select('entity_type, entity_name, action, field_changed, old_value, new_value, note, created_at, actor:user_id(name)')
    .eq('event_id', event_id)
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return res.status(500).json({ error: error.message })

  if (!logs || logs.length === 0) {
    const emptyMsg = lang === 'en'
      ? 'No activity recorded in this time period.'
      : '此時間範圍內無任何活動記錄。'
    return res.status(200).json({ summary: emptyMsg, entry_count: 0 })
  }

  const lines = logs.map((entry) => formatLine(entry, lang))

  const prompt = lang === 'en'
    ? `You are summarizing recent activity for a Buddhist Town event management team.

Activity log:
${lines.join('\n')}

Write a brief summary (2–3 sentences) of the team's recent progress. Mention specific tasks and people. Keep the tone neutral and factual. Respond in English.`
    : `You are summarizing recent activity for a Buddhist Town event management team.

Activity log:
${lines.join('\n')}

請用繁體中文寫一段簡短的摘要（2至3句），說明團隊近期的工作進展。請具體提及相關任務和人員，語氣保持中立、客觀。`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    })

    const summary = message.content[0]?.text ?? (lang === 'en' ? 'Unable to generate summary.' : '無法生成摘要。')
    return res.status(200).json({ summary, entry_count: logs.length })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
