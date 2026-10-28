import { query, insertLog } from '@/lib/db'
import { requireAdmin, authOptions } from '@/lib/auth'
import { getServerSession } from 'next-auth'

// PATCH /api/events/[id]  { status: 'active' | 'archived' }  — admin only.
// 'archived' is shown as 已結束 (ended) in the UI.
export default async function handler(req, res) {
  const { id } = req.query

  if (req.method === 'PATCH') {
    if (await requireAdmin(req, res)) return
    const session = await getServerSession(req, res, authOptions)

    const { status } = req.body ?? {}
    if (!['active', 'archived'].includes(status)) {
      return res.status(400).json({ error: "status must be 'active' or 'archived'" })
    }

    const { rows: [before] } = await query('SELECT id, name, status FROM events WHERE id = $1', [id])
    if (!before) return res.status(404).json({ error: 'Event not found' })

    const { rows: [data] } = await query(
      'UPDATE events SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    )

    if (before.status !== status) {
      await insertLog({
        event_id:      id,
        user_id:       session?.user?.id ?? null,
        entity_type:   'event',
        entity_id:     id,
        entity_name:   before.name,
        action:        'updated',
        field_changed: 'status',
        old_value:     before.status,
        new_value:     status,
      })
    }

    return res.status(200).json(data)
  }

  res.setHeader('Allow', ['PATCH'])
  return res.status(405).end()
}
