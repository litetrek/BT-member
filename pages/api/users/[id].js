import { requireAdmin } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

export default async function handler(req, res) {
  if (await requireAdmin(req, res)) return

  const { id, event_id } = req.query
  const supabase = createServerClient()

  if (req.method === 'PUT') {
    const { role, name, event_id: bodyEventId } = req.body
    const eid = bodyEventId || event_id
    if (!eid) return res.status(400).json({ error: 'event_id required' })

    // Update name in users table if provided
    if (name !== undefined) {
      const { error: nameErr } = await supabase
        .from('users')
        .update({ name })
        .eq('id', id)
      if (nameErr) return res.status(500).json({ error: nameErr.message })
    }

    // Update role in event_members if provided
    if (role !== undefined) {
      const { error: roleErr } = await supabase
        .from('event_members')
        .update({ role })
        .eq('user_id', id)
        .eq('event_id', eid)
      if (roleErr) return res.status(500).json({ error: roleErr.message })
    }

    return res.status(200).json({ ok: true })
  }

  if (req.method === 'DELETE') {
    if (!event_id) return res.status(400).json({ error: 'event_id required' })
    const { error } = await supabase
      .from('event_members')
      .delete()
      .eq('user_id', id)
      .eq('event_id', event_id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(204).end()
  }

  res.setHeader('Allow', ['PUT', 'DELETE'])
  return res.status(405).end()
}
