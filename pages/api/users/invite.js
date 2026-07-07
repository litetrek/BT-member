import { requireAdmin } from '@/lib/auth'
import { query } from '@/lib/db'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).end()
  }

  if (await requireAdmin(req, res)) return

  const { name, email, role = 'member', event_id } = req.body
  if (!email || !event_id) return res.status(400).json({ error: 'email and event_id required' })

  let { rows: [user] } = await query(
    'SELECT id FROM users WHERE email = $1',
    [email]
  )

  if (!user) {
    const { rows: [newUser] } = await query(
      'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id',
      [email, name || null]
    )
    user = newUser
  } else if (name) {
    await query(
      'UPDATE users SET name = $1 WHERE id = $2 AND name IS NULL',
      [name, user.id]
    )
  }

  const { rowCount } = await query(
    `INSERT INTO event_members (event_id, user_id, role) VALUES ($1, $2, $3)
     ON CONFLICT (event_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [event_id, user.id, role]
  )
  if (!rowCount) return res.status(500).json({ error: 'Membership upsert failed' })

  return res.status(200).json({ ok: true })
}
