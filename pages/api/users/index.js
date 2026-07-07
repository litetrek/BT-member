import { query } from '@/lib/db'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).end()
  }

  const { event_id } = req.query

  if (!event_id) {
    const { rows } = await query(
      'SELECT id, name, email, avatar_url FROM users WHERE name IS NOT NULL ORDER BY name'
    )
    return res.status(200).json(rows)
  }

  const { rows: members, rowCount } = await query(
    'SELECT user_id, role, joined_at FROM event_members WHERE event_id = $1',
    [event_id]
  )
  if (!rowCount) return res.status(200).json([])

  const userIds = members.map((m) => m.user_id)
  const { rows: users } = await query(
    'SELECT id, name, email, avatar_url, preferred_lang FROM users WHERE id = ANY($1)',
    [userIds]
  )

  const memberMap = Object.fromEntries(members.map((m) => [m.user_id, m]))

  const result = users
    .map((u) => ({
      ...u,
      role:      memberMap[u.id]?.role      ?? 'member',
      joined_at: memberMap[u.id]?.joined_at,
      status:    u.name ? 'active' : 'invited',
    }))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1
      return (a.name ?? a.email).localeCompare(b.name ?? b.email)
    })

  return res.status(200).json(result)
}
