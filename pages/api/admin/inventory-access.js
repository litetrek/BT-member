import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'
import { getInventoryRole } from '@/lib/inventory'

// Grants/updates (POST) or revokes (DELETE) a person's role in one Inventory Control
// module. Gated per-module: the requester must themselves be 'admin' of moduleKey —
// deliberately NOT a portal-wide admin check, so a future second module's admin can
// manage their own module's access without needing rights over Lanterns too.
export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'POST') {
    const { email, module_key, role } = req.body
    if (!email || !module_key || !role) {
      return res.status(400).json({ error: 'email, module_key and role are required' })
    }
    if (getInventoryRole(session, module_key) !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Lazily create a placeholder user row, same pattern as /api/users/invite —
    // they show up as "pending" until they actually sign in via Google.
    await query(
      `INSERT INTO users (email) VALUES ($1) ON CONFLICT (email) DO NOTHING`,
      [normalizedEmail]
    )

    const { rows: [data] } = await query(
      `INSERT INTO inventory_module_access (email, module_key, role, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $4)
       ON CONFLICT (email, module_key) DO UPDATE SET role = EXCLUDED.role, updated_at = now(), updated_by = EXCLUDED.updated_by
       RETURNING *`,
      [normalizedEmail, module_key, role, session.user.email]
    )
    return res.status(200).json(data)
  }

  if (req.method === 'DELETE') {
    const { email, module_key } = req.query
    if (!email || !module_key) {
      return res.status(400).json({ error: 'email and module_key are required' })
    }
    if (getInventoryRole(session, module_key) !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' })
    }

    await query(
      'DELETE FROM inventory_module_access WHERE email = $1 AND module_key = $2',
      [email.toLowerCase().trim(), module_key]
    )
    return res.status(204).end()
  }

  res.setHeader('Allow', ['POST', 'DELETE'])
  res.status(405).end()
}
