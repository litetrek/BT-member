import { createServerClient } from '@/lib/supabase/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export default async function handler(req, res) {
  const supabase = createServerClient()

  if (req.method === 'GET') {
    const { slug } = req.query
    if (!slug) return res.status(400).json({ error: 'slug is required' })

    const { data: event } = await supabase
      .from('events')
      .select('id')
      .eq('slug', slug)
      .single()

    if (!event) return res.status(404).json({ error: 'Event not found' })

    const { data, error } = await supabase
      .from('activities')
      .select(`
        *,
        lead:lead_id (id, name, email, avatar_url),
        co_lead:co_lead_id (id, name, email, avatar_url),
        tasks (id, status)
      `)
      .eq('event_id', event.id)
      .order('sort_order')

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'POST') {
    const session = await getServerSession(req, res, authOptions)
    if (!session || session.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const { event_id, lead_id, co_lead_id, name, icon, sort_order } = req.body
    const { data, error } = await supabase
      .from('activities')
      .insert({ event_id, lead_id, co_lead_id: co_lead_id || null, name, icon, sort_order: sort_order ?? 0 })
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  res.setHeader('Allow', ['GET', 'POST'])
  res.status(405).end()
}
