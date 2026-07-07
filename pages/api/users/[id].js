import { requireAdmin, authOptions } from '@/lib/auth'
import { getServerSession } from 'next-auth'
import { query, insertLog } from '@/lib/db'

export default async function handler(req, res) {
  const { id, event_id } = req.query

  if (req.method === 'PUT') {
    const session = await getServerSession(req, res, authOptions)
    if (!session) return res.status(401).json({ error: 'Unauthorized' })

    const { role, name, preferred_lang, event_id: bodyEventId } = req.body
    const eid     = bodyEventId || event_id
    const isAdmin = session.user.role === 'admin'
    const isSelf  = session.user.id === id

    if (preferred_lang !== undefined) {
      if (!isSelf && !isAdmin) return res.status(403).json({ error: 'Forbidden' })
      if (!['en', 'zh'].includes(preferred_lang)) {
        return res.status(400).json({ error: 'preferred_lang must be en or zh' })
      }
      const { rowCount } = await query(
        'UPDATE users SET preferred_lang = $1 WHERE id = $2',
        [preferred_lang, id]
      )
      if (!rowCount) return res.status(500).json({ error: 'Update failed' })

      if (isSelf) {
        await insertLog({
          user_id:       session.user.id,
          entity_type:   'user',
          action:        'updated',
          field_changed: 'preferred_lang',
          new_value:     preferred_lang,
        })
      }
    }

    if (name !== undefined || role !== undefined) {
      if (!isAdmin) return res.status(403).json({ error: 'Forbidden' })
      if (!eid) return res.status(400).json({ error: 'event_id required' })

      if (name !== undefined) {
        await query('UPDATE users SET name = $1 WHERE id = $2', [name, id])
      }

      if (role !== undefined) {
        await query(
          'UPDATE event_members SET role = $1 WHERE user_id = $2 AND event_id = $3',
          [role, id, eid]
        )
      }
    }

    return res.status(200).json({ ok: true })
  }

  if (req.method === 'DELETE') {
    if (await requireAdmin(req, res)) return
    if (!event_id) return res.status(400).json({ error: 'event_id required' })
    await query(
      'DELETE FROM event_members WHERE user_id = $1 AND event_id = $2',
      [id, event_id]
    )
    return res.status(204).end()
  }

  res.setHeader('Allow', ['PUT', 'DELETE'])
  return res.status(405).end()
}
