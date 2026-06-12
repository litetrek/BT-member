import { createServerClient } from '@/lib/supabase/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export default async function handler(req, res) {
  const supabase = createServerClient()

  if (req.method === 'GET') {
    const { slug } = req.query
    if (!slug) return res.status(400).json({ error: 'slug is required' })

    const { data: event, error: eventError } = await supabase
      .from('events').select('id').eq('slug', slug).single()
    if (eventError || !event) return res.status(404).json({ error: 'Event not found' })

    const { data: activities, error: actError } = await supabase
      .from('activities').select('*').eq('event_id', event.id).order('sort_order')
    if (actError) return res.status(500).json({ error: actError.message })
    if (!activities.length) return res.status(200).json([])

    const activityIds = activities.map((a) => a.id)
    const { data: tasks } = await supabase
      .from('tasks').select('id, activity_id, status').in('activity_id', activityIds)

    const userIds = [...new Set(activities.flatMap((a) => [a.lead_id, a.co_lead_id].filter(Boolean)))]
    const { data: users } = await supabase
      .from('users').select('id, name, email, avatar_url').in('id', userIds)

    const userMap = Object.fromEntries((users ?? []).map((u) => [u.id, u]))
    const tasksByActivity = (tasks ?? []).reduce((acc, t) => {
      if (!acc[t.activity_id]) acc[t.activity_id] = []
      acc[t.activity_id].push(t)
      return acc
    }, {})

    const result = activities.map((a) => ({
      ...a,
      lead:    userMap[a.lead_id]    ?? null,
      co_lead: userMap[a.co_lead_id] ?? null,
      tasks:   tasksByActivity[a.id] ?? [],
    }))

    return res.status(200).json(result)
  }

  if (req.method === 'POST') {
    const session = await getServerSession(req, res, authOptions)
    if (!session || session.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const { event_id, lead_id, co_lead_id, name, icon, sort_order } = req.body
    const { data, error } = await supabase
      .from('activities')
      .insert({ event_id, lead_id, co_lead_id: co_lead_id || null, name, icon, sort_order: sort_order ?? 0 })
      .select().single()

    if (error) return res.status(500).json({ error: error.message })

    await supabase.from('activity_log').insert({
      event_id,
      user_id:     session.user.id,
      entity_type: 'activity',
      entity_id:   data.id,
      entity_name: name,
      action:      'created',
    })

    return res.status(201).json(data)
  }

  res.setHeader('Allow', ['GET', 'POST'])
  res.status(405).end()
}
