import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function timeAgo(ts) {
  const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000)
  if (mins < 60)   return `${mins} min ago`
  if (mins < 1440) return `${Math.round(mins / 60)} hrs ago`
  return `${Math.round(mins / 1440)} days ago`
}

function formatLine(entry) {
  const actor = entry.actor?.name ?? 'Someone'
  const name  = entry.entity_name ? `'${entry.entity_name}'` : entry.entity_type
  const when  = timeAgo(entry.created_at)

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
    return res.status(200).json({ summary: 'No activity recorded in this time period.', entry_count: 0 })
  }

  const lines = logs.map(formatLine)

  const prompt = `You are summarizing recent activity for a Buddhist Town event management team.

Activity log:
${lines.join('\n')}

Write a concise 2–3 sentence prose summary of what the team has been working on. Be specific about tasks and people. Use a neutral, factual tone.`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    })

    const summary = message.content[0]?.text ?? 'Unable to generate summary.'
    return res.status(200).json({ summary, entry_count: logs.length })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
