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
    const { data, error } = await supabase
      .from('activities')
      .update({ lead_id, co_lead_id: co_lead_id || null, name, icon, sort_order })
      .eq('id', id)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase.from('activities').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(204).end()
  }

  res.setHeader('Allow', ['PUT', 'DELETE'])
  res.status(405).end()
}
