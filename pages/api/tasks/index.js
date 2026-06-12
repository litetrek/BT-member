import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

export default async function handler(req, res) {
  const supabase = createServerClient()

  if (req.method === 'GET') {
    const { slug, activity_id, status } = req.query
    if (!slug) return res.status(400).json({ error: 'slug required' })

    const { data: event } = await supabase.from('events').select('id').eq('slug', slug).single()
    if (!event) return res.status(404).json({ error: 'Event not found' })

    const { data: activityRows } = await supabase.from('activities').select('id').eq('event_id', event.id)
    const activityIds = (activityRows ?? []).map((a) => a.id)
    if (!activityIds.length) return res.status(200).json([])

    let query = supabase
      .from('tasks')
      .select('*, activity:activity_id(id, name), assignee1:assignee_1_id(id, name, email, avatar_url), assignee2:assignee_2_id(id, name, email, avatar_url)')
      .in('activity_id', activityIds)
      .order('created_at', { ascending: false })

    if (activity_id) query = query.eq('activity_id', activity_id)

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })

    const today = new Date(); today.setHours(0, 0, 0, 0)
    let tasks = data ?? []

    if (status === 'overdue') {
      tasks = tasks.filter((t) => t.status !== 'done' && t.due_date && new Date(t.due_date) < today)
    } else if (status && status !== 'all') {
      tasks = tasks.filter((t) => t.status === status)
    }

    return res.status(200).json(tasks)
  }

  if (req.method === 'POST') {
    const session = await getServerSession(req, res, authOptions)
    if (!session || !['admin', 'lead'].includes(session.user?.role)) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const { title, activity_id, status = 'open', assignee_1_id, assignee_2_id, due_date } = req.body
    if (!title || !activity_id || !assignee_1_id) {
      return res.status(400).json({ error: 'title, activity_id, assignee_1_id required' })
    }

    const { data, error } = await supabase.from('tasks').insert({
      title,
      activity_id,
      status,
      assignee_1_id,
      assignee_2_id: assignee_2_id || null,
      due_date: due_date || null,
      created_by: session.user.id,
    }).select().single()

    if (error) return res.status(500).json({ error: error.message })

    const { data: act } = await supabase.from('activities').select('event_id').eq('id', activity_id).single()
    await supabase.from('activity_log').insert({
      event_id: act?.event_id ?? null,
      task_id: data.id,
      user_id: session.user.id,
      action: 'task_created',
    })

    return res.status(201).json(data)
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).end()
}
