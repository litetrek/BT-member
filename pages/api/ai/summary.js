import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const ACTION_READABLE = {
  task_created:        'created a task',
  task_updated:        'updated a task',
  task_status_changed: 'changed task status to',
  task_note_updated:   'added a note to a task',
  task_deleted:        'deleted a task',
  activity_created:    'created an activity',
  activity_updated:    'updated an activity',
  activity_deleted:    'deleted an activity',
  announcement_created:'posted an announcement',
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
    .select('*, user:user_id(name), task:task_id(title)')
    .eq('event_id', event_id)
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return res.status(500).json({ error: error.message })

  if (!logs || logs.length === 0) {
    return res.status(200).json({ summary: 'No activity recorded in this time period.' })
  }

  // Format log entries for Claude
  const lines = logs.map((entry) => {
    const who = entry.user?.name ?? 'Someone'
    const verb = ACTION_READABLE[entry.action] ?? entry.action.replace(/_/g, ' ')
    const taskRef = entry.task?.title ? ` "${entry.task.title}"` : ''
    const detail = entry.action === 'task_status_changed' && entry.note ? ` ${entry.note}` : ''
    const noteText = entry.action === 'task_note_updated' && entry.note ? `: "${entry.note}"` : ''
    const mins = Math.round((Date.now() - new Date(entry.created_at).getTime()) / 60000)
    const timeAgo = mins < 60 ? `${mins}m ago` : mins < 1440 ? `${Math.round(mins / 60)}h ago` : `${Math.round(mins / 1440)}d ago`
    return `- ${who} ${verb}${detail}${taskRef}${noteText} (${timeAgo})`
  })

  const prompt = `You are summarizing recent activity for a Buddhist Town event management team.

Recent activity log:
${lines.join('\n')}

Write a concise 2–3 sentence prose summary of what the team has been working on. Be specific about tasks and people mentioned. Use a neutral, factual tone.`

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
