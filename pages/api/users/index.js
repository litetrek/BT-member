import { createServerClient } from '@/lib/supabase/server'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).end()
  }

  const supabase = createServerClient()
  const { event_id } = req.query

  let query = supabase.from('users').select('id, name, email, avatar_url')

  if (event_id) {
    const { data: members } = await supabase
      .from('event_members')
      .select('user_id')
      .eq('event_id', event_id)

    const ids = (members ?? []).map((m) => m.user_id)
    if (ids.length) query = query.in('id', ids)
  }

  const { data, error } = await query.order('name')
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json(data)
}
