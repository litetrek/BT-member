import { requireAdmin, authOptions } from '@/lib/auth'
import { getServerSession } from 'next-auth'
import { createServerClient } from '@/lib/supabase/server'

export default async function handler(req, res) {
  const { id, event_id } = req.query
  const supabase = createServerClient()

  if (req.method === 'PUT') {
    const session = await getServerSession(req, res, authOptions)
    if (!session) return res.status(401).json({ error: 'Unauthorized' })

    const { role, name, preferred_lang, event_id: bodyEventId } = req.body
    const eid = bodyEventId || event_id
    const isAdmin = session.user.role === 'admin'
    const isSelf  = session.user.id === id

    // preferred_lang: self or admin only
    if (preferred_lang !== undefined) {
      if (!isSelf && !isAdmin) return res.status(403).json({ error: 'Forbidden' })
      if (!['en', 'zh'].includes(preferred_lang)) return res.status(400).json({ error: 'preferred_lang must be en or zh' })
      const { error: langErr } = await supabase.from('users').update({ preferred_lang }).eq('id', id)
      if (langErr) return res.status(500).json({ error: langErr.message })
      if (isSelf) {
        await supabase.from('activity_log').insert({
          user_id: session.user.id,
          entity_type: 'user',
          action: 'updated',
          field_changed: 'preferred_lang',
          new_value: preferred_lang,
        })
      }
    }

    // name and role: admin only
    if (name !== undefined || role !== undefined) {
      if (!isAdmin) return res.status(403).json({ error: 'Forbidden' })
      if (!eid) return res.status(400).json({ error: 'event_id required' })

      if (name !== undefined) {
        const { error: nameErr } = await supabase.from('users').update({ name }).eq('id', id)
        if (nameErr) return res.status(500).json({ error: nameErr.message })
      }

      if (role !== undefined) {
        const { error: roleErr } = await supabase
          .from('event_members')
          .update({ role })
          .eq('user_id', id)
          .eq('event_id', eid)
        if (roleErr) return res.status(500).json({ error: roleErr.message })
      }
    }

    return res.status(200).json({ ok: true })
  }

  if (req.method === 'DELETE') {
    if (await requireAdmin(req, res)) return
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
