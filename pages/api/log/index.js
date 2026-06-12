import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).end()
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })

  const { event_id, task_id, hours } = req.query
  if (!event_id && !task_id) return res.status(400).json({ error: 'event_id or task_id required' })

  const supabase = createServerClient()
  let query = supabase
    .from('activity_log')
    .select('*, user:user_id(id, name, avatar_url), task:task_id(id, title)')
    .order('created_at', { ascending: false })
    .limit(200)

  if (event_id) query = query.eq('event_id', event_id)
  if (task_id)  query = query.eq('task_id', task_id)

  if (hours) {
    const cutoff = new Date(Date.now() - Number(hours) * 3600 * 1000)
    query = query.gte('created_at', cutoff.toISOString())
  }

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json(data ?? [])
}
