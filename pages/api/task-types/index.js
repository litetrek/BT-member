import { query } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const DEFAULT_TYPES = [
  { name: '一般' },
  { name: '採購' },
  { name: '聯絡溝通' },
  { name: '現場工作' },
]

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })

  const { event_id } = req.query

  if (req.method === 'GET') {
    if (!event_id) return res.status(400).json({ error: 'event_id is required' })

    const { rows } = await query(
      'SELECT * FROM task_types WHERE event_id = $1 ORDER BY created_at ASC',
      [event_id]
    )

    if (rows.length === 0) {
      const seeded = []
      for (const t of DEFAULT_TYPES) {
        const { rows: [row] } = await query(
          'INSERT INTO task_types (event_id, name, created_by) VALUES ($1, $2, $3) RETURNING *',
          [event_id, t.name, session.user.id]
        )
        seeded.push(row)
      }
      return res.status(200).json(seeded)
    }

    return res.status(200).json(rows)
  }

  if (req.method === 'POST') {
    if (session.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' })

    const { name } = req.body
    if (!name?.trim() || !event_id) return res.status(400).json({ error: 'name and event_id required' })

    const { rows: [data] } = await query(
      'INSERT INTO task_types (event_id, name, created_by) VALUES ($1, $2, $3) RETURNING *',
      [event_id, name.trim(), session.user.id]
    )
    return res.status(201).json(data)
  }

  res.setHeader('Allow', ['GET', 'POST'])
  res.status(405).end()
}
