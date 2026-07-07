import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query, insertLog } from '@/lib/db'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { slug, activity_id, status } = req.query
    if (!slug) return res.status(400).json({ error: 'slug required' })

    const { rows: [event] } = await query(
      'SELECT id FROM events WHERE slug = $1',
      [slug]
    )
    if (!event) return res.status(404).json({ error: 'Event not found' })

    const { rows: activityRows } = await query(
      'SELECT id FROM activities WHERE event_id = $1',
      [event.id]
    )
    const activityIds = activityRows.map((a) => a.id)
    if (!activityIds.length) return res.status(200).json([])

    const conditions = ['t.activity_id = ANY($1)']
    const params     = [activityIds]

    if (activity_id) {
      conditions.push(`t.activity_id = $${params.length + 1}`)
      params.push(activity_id)
    }

    const { rows: data } = await query(
      `SELECT t.*,
         json_build_object('id', a.id, 'name', a.name) AS activity,
         json_build_object('id', u1.id, 'name', u1.name, 'email', u1.email, 'avatar_url', u1.avatar_url) AS assignee1,
         CASE WHEN t.assignee_2_id IS NOT NULL
           THEN json_build_object('id', u2.id, 'name', u2.name, 'email', u2.email, 'avatar_url', u2.avatar_url)
           ELSE NULL END AS assignee2
       FROM tasks t
       LEFT JOIN activities a  ON a.id  = t.activity_id
       LEFT JOIN users u1      ON u1.id = t.assignee_1_id
       LEFT JOIN users u2      ON u2.id = t.assignee_2_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY t.created_at DESC`,
      params
    )

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

    const { title, activity_id, status = 'open', assignee_1_id, assignee_2_id, due_date, description, task_type } = req.body
    if (!title || !activity_id || !assignee_1_id) {
      return res.status(400).json({ error: 'title, activity_id, assignee_1_id required' })
    }

    const { rows: [data] } = await query(
      `INSERT INTO tasks (title, activity_id, status, assignee_1_id, assignee_2_id, due_date, description, task_type, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [title, activity_id, status, assignee_1_id, assignee_2_id || null, due_date || null, description || null, task_type || 'general', session.user.id]
    )

    const { rows: [act] } = await query(
      'SELECT event_id FROM activities WHERE id = $1',
      [activity_id]
    )

    const logEntries = [{
      event_id:    act?.event_id ?? null,
      user_id:     session.user.id,
      entity_type: 'task',
      entity_id:   data.id,
      entity_name: title,
      action:      'created',
      new_value:   status,
    }]

    if (description) {
      logEntries.push({
        event_id:      act?.event_id ?? null,
        user_id:       session.user.id,
        entity_type:   'task',
        entity_id:     data.id,
        entity_name:   title,
        action:        'updated',
        field_changed: 'description',
        new_value:     description.substring(0, 100),
      })
    }

    for (const entry of logEntries) await insertLog(entry)

    return res.status(201).json(data)
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).end()
}
