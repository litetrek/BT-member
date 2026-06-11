import { createServerClient } from '@/lib/supabase/server'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).end()
  }

  const supabase = createServerClient()
  const { slug } = req.query

  if (!slug) return res.status(400).json({ error: 'slug is required' })

  const { data: event } = await supabase
    .from('events')
    .select('id')
    .eq('slug', slug)
    .single()

  if (!event) return res.status(404).json({ error: 'Event not found' })

  const { data: activityRows } = await supabase
    .from('activities')
    .select('id')
    .eq('event_id', event.id)

  const activityIds = (activityRows ?? []).map((a) => a.id)
  if (!activityIds.length) return res.status(200).json([])

  const { data, error } = await supabase
    .from('tasks')
    .select('*, activity:activity_id(name)')
    .in('activity_id', activityIds)
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json(data)
}
