import { createServerClient } from '@/lib/supabase/server'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).end()
  }

  const supabase = createServerClient()
  const { event_id } = req.query

  if (!event_id) {
    // Simple list without role — for form selects (exclude placeholders)
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, avatar_url')
      .not('name', 'is', null)
      .order('name')
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  // With event_id: return members with role and status
  const { data: members, error: mErr } = await supabase
    .from('event_members')
    .select('user_id, role, joined_at')
    .eq('event_id', event_id)
  if (mErr) return res.status(500).json({ error: mErr.message })
  if (!members?.length) return res.status(200).json([])

  const userIds = members.map((m) => m.user_id)
  const { data: users, error: uErr } = await supabase
    .from('users')
    .select('id, name, email, avatar_url, preferred_lang')
    .in('id', userIds)
  if (uErr) return res.status(500).json({ error: uErr.message })

  const memberMap = Object.fromEntries(members.map((m) => [m.user_id, m]))

  const result = (users ?? [])
    .map((u) => ({
      ...u,
      role: memberMap[u.id]?.role ?? 'member',
      joined_at: memberMap[u.id]?.joined_at,
      status: u.name ? 'active' : 'invited',
    }))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1
      return (a.name ?? a.email).localeCompare(b.name ?? b.email)
    })

  return res.status(200).json(result)
}
