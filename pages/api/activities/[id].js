import { createServerClient } from '@/lib/supabase/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export default async function handler(req, res) {
  const supabase = createServerClient()
  const { id } = req.query

  const session = await getServerSession(req, res, authOptions)
  if (!session || session.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' })
  }

  if (req.method === 'PUT') {
    const { lead_id, co_lead_id, name, icon, sort_order } = req.body

    const { data: act } = await supabase
      .from('activities').select('event_id, name').eq('id', id).single()

    const { data, error } = await supabase
      .from('activities')
      .update({ lead_id, co_lead_id: co_lead_id || null, name, icon, sort_order })
      .eq('id', id).select().single()

    if (error) return res.status(500).json({ error: error.message })

    await supabase.from('activity_log').insert({
      event_id:    act?.event_id ?? null,
      user_id:     session.user.id,
      entity_type: 'activity',
      entity_id:   id,
      entity_name: act?.name ?? name,
      action:      'updated',
    })

    return res.status(200).json(data)
  }

  if (req.method === 'DELETE') {
    const { data: act } = await supabase
      .from('activities').select('event_id, name').eq('id', id).single()

    const { error } = await supabase.from('activities').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })

    await supabase.from('activity_log').insert({
      event_id:    act?.event_id ?? null,
      user_id:     session.user.id,
      entity_type: 'activity',
      entity_id:   id,
      entity_name: act?.name ?? null,
      action:      'deleted',
    })

    return res.status(204).end()
  }

  res.setHeader('Allow', ['PUT', 'DELETE'])
  res.status(405).end()
}
