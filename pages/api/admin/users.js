import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'
import { isInventoryAdminOfAny } from '@/lib/inventory'

// Backs the unified /admin/users screen: every user, every event, every event
// membership, and every Inventory Control module_key→role grant in one shot. Visible
// to anyone who administers at least one event OR at least one inventory module —
// per-column edit rights are then enforced both client-side (hide the control) and
// server-side (each write endpoint re-checks that specific event/module).
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).end()
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })

  const isEventAdmin = session.user.role === 'admin'
  const isModuleAdmin = isInventoryAdminOfAny(session)
  if (!isEventAdmin && !isModuleAdmin) return res.status(403).json({ error: 'Forbidden' })

  const [users, events, eventMembers, moduleAccess] = await Promise.all([
    query('SELECT id, name, email, avatar_url, last_signed_in_at FROM users ORDER BY name NULLS LAST, email'),
    query('SELECT id, name, slug FROM events ORDER BY event_date DESC'),
    query('SELECT event_id, user_id, role FROM event_members'),
    query('SELECT email, module_key, role FROM inventory_module_access'),
  ])

  return res.status(200).json({
    users: users.rows,
    events: events.rows,
    eventMembers: eventMembers.rows,
    moduleAccess: moduleAccess.rows,
  })
}
