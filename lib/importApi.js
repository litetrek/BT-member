import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'
import { ensureImportSchema } from '@/lib/importSchema'

// Shared guard for /api/import/*: coordinators (admin or lead) only, and the event
// must exist. Sends the error response itself and returns null when not allowed.
export async function importGuard(req, res, eventId) {
  const session = await getServerSession(req, res, authOptions)
  if (!session || !['admin', 'lead'].includes(session.user?.role)) {
    res.status(403).json({ error: 'Forbidden' })
    return null
  }
  if (!eventId) {
    res.status(400).json({ error: 'event_id is required' })
    return null
  }
  const { rows: [event] } = await query('SELECT id, name, slug, event_date FROM events WHERE id = $1', [eventId])
  if (!event) {
    res.status(404).json({ error: 'Event not found' })
    return null
  }
  try {
    await ensureImportSchema()
  } catch (err) {
    console.error('[import] schema setup failed:', err.message)
    res.status(500).json({ error: '資料庫設定失敗，請稍後再試' })
    return null
  }
  return { session, event }
}

export const isUuid = (v) => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)
