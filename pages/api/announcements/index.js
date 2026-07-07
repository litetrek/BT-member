import { query, insertLog } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { event_id } = req.query
    if (!event_id) return res.status(400).json({ error: 'event_id is required' })

    const { rows } = await query(
      `SELECT ann.*,
         json_build_object('name', u1.name, 'avatar_url', u1.avatar_url) AS creator,
         CASE WHEN ann.reporter_id IS NOT NULL
           THEN json_build_object('name', u2.name, 'avatar_url', u2.avatar_url)
           ELSE NULL END AS reporter,
         CASE WHEN ann.activity_id IS NOT NULL
           THEN json_build_object('name', act.name)
           ELSE NULL END AS activity
       FROM announcements ann
       LEFT JOIN users u1  ON u1.id  = ann.created_by
       LEFT JOIN users u2  ON u2.id  = ann.reporter_id
       LEFT JOIN activities act ON act.id = ann.activity_id
       WHERE ann.event_id = $1
       ORDER BY ann.created_at DESC`,
      [event_id]
    )
    return res.status(200).json(rows)
  }

  if (req.method === 'POST') {
    const session = await getServerSession(req, res, authOptions)
    if (!session || !['admin', 'lead'].includes(session.user?.role)) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const { event_id, message, activity_id, reporter_id, reported_at } = req.body

    const { rows: [data] } = await query(
      `INSERT INTO announcements (event_id, message, created_by, activity_id, reporter_id, reported_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [event_id, message, session.user.id, activity_id || null, reporter_id || null, reported_at || null]
    )

    await insertLog({
      event_id,
      user_id:     session.user.id,
      entity_type: 'announcement',
      entity_id:   data.id,
      entity_name: message.substring(0, 60),
      action:      'created',
    })

    return res.status(201).json(data)
  }

  res.setHeader('Allow', ['GET', 'POST'])
  res.status(405).end()
}
