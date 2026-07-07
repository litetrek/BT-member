import { query, insertLog } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { slug } = req.query
    if (!slug) return res.status(400).json({ error: 'slug is required' })

    const { rows: [event] } = await query(
      'SELECT id FROM events WHERE slug = $1',
      [slug]
    )
    if (!event) return res.status(404).json({ error: 'Event not found' })

    const { rows: activities } = await query(
      'SELECT * FROM activities WHERE event_id = $1 ORDER BY sort_order',
      [event.id]
    )
    if (!activities.length) return res.status(200).json([])

    const activityIds = activities.map((a) => a.id)
    const { rows: tasks } = await query(
      'SELECT id, activity_id, status FROM tasks WHERE activity_id = ANY($1)',
      [activityIds]
    )

    const userIds = [...new Set(activities.flatMap((a) => [a.lead_id, a.co_lead_id].filter(Boolean)))]
    const userRows = userIds.length
      ? (await query(
          'SELECT id, name, email, avatar_url FROM users WHERE id = ANY($1)',
          [userIds]
        )).rows
      : []

    const userMap = Object.fromEntries(userRows.map((u) => [u.id, u]))
    const tasksByActivity = tasks.reduce((acc, t) => {
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
    const { rows: [data] } = await query(
      `INSERT INTO activities (event_id, lead_id, co_lead_id, name, icon, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [event_id, lead_id, co_lead_id || null, name, icon, sort_order ?? 0]
    )

    await insertLog({
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
