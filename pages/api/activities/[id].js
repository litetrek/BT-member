import { query, insertLog } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export default async function handler(req, res) {
  const { id } = req.query

  const session = await getServerSession(req, res, authOptions)
  if (!session || session.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' })
  }

  if (req.method === 'PUT') {
    const { lead_id, co_lead_id, name, icon, sort_order } = req.body

    const { rows: [act] } = await query(
      'SELECT event_id, name FROM activities WHERE id = $1',
      [id]
    )

    const { rows: [data], rowCount } = await query(
      `UPDATE activities
       SET lead_id = $1, co_lead_id = $2, name = $3, icon = $4, sort_order = $5
       WHERE id = $6
       RETURNING *`,
      [lead_id, co_lead_id || null, name, icon, sort_order, id]
    )
    if (!rowCount) return res.status(500).json({ error: 'Update failed' })

    await insertLog({
      event_id:    act?.event_id ?? null,
      user_id:     session.user.id,
      entity_type: 'activity',
      entity_id:   id,
      entity_name: act?.name ?? name,
      action:      'updated',
    })

    return res.status(200).json(data)
  }

  if (req.method === 'DELETE') {
    const { rows: [act] } = await query(
      'SELECT event_id, name FROM activities WHERE id = $1',
      [id]
    )

    const { rowCount } = await query('DELETE FROM activities WHERE id = $1', [id])
    if (!rowCount) return res.status(500).json({ error: 'Delete failed' })

    await insertLog({
      event_id:    act?.event_id ?? null,
      user_id:     session.user.id,
      entity_type: 'activity',
      entity_id:   id,
      entity_name: act?.name ?? null,
      action:      'deleted',
    })

    return res.status(204).end()
  }

  res.setHeader('Allow', ['PUT', 'DELETE'])
  res.status(405).end()
}
