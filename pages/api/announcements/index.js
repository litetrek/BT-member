import { createServerClient } from '@/lib/supabase/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export default async function handler(req, res) {
  const supabase = createServerClient()

  if (req.method === 'GET') {
    const { event_id } = req.query
    if (!event_id) return res.status(400).json({ error: 'event_id is required' })

    const { data, error } = await supabase
      .from('announcements')
      .select('*, creator:created_by(name, avatar_url)')
      .eq('event_id', event_id)
      .order('created_at', { ascending: false })

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'POST') {
    const session = await getServerSession(req, res, authOptions)
    if (!session || !['admin', 'lead'].includes(session.user?.role)) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const { event_id, message } = req.body
    const { data, error } = await supabase
      .from('announcements')
      .insert({ event_id, message, created_by: session.user.id })
      .select().single()

    if (error) return res.status(500).json({ error: error.message })

    await supabase.from('activity_log').insert({
      event_id,
      user_id:     session.user.id,
      entity_type: 'announcement',
      entity_id:   data.id,
      entity_name: message.substring(0, 60),
      action:      'created',
    })

    return res.status(201).json(data)
  }

  res.setHeader('Allow', ['GET', 'POST'])
  res.status(405).end()
}
