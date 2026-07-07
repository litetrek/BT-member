import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).end()
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })

  const { event_id, task_id, hours } = req.query
  if (!event_id && !task_id) return res.status(400).json({ error: 'event_id or task_id required' })

  const conditions = []
  const params     = []

  if (task_id) {
    conditions.push(`al.entity_id = $${params.length + 1}`)
    params.push(task_id)
    conditions.push(`al.entity_type = 'task'`)
  } else {
    conditions.push(`al.event_id = $${params.length + 1}`)
    params.push(event_id)
  }

  if (hours) {
    const cutoff = new Date(Date.now() - Number(hours) * 3600 * 1000)
    conditions.push(`al.created_at >= $${params.length + 1}`)
    params.push(cutoff.toISOString())
  }

  const { rows } = await query(
    `SELECT al.id, al.entity_type, al.entity_name, al.action, al.field_changed,
            al.old_value, al.new_value, al.note, al.created_at,
       CASE WHEN al.user_id IS NOT NULL
         THEN json_build_object('name', u.name, 'avatar_url', u.avatar_url)
         ELSE NULL END AS actor
     FROM activity_log al
     LEFT JOIN users u ON u.id = al.user_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY al.created_at DESC
     LIMIT 200`,
    params
  )

  return res.status(200).json(rows ?? [])
}
