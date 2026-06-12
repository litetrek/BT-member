import { createServerClient } from '@/lib/supabase/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const DEFAULT_TYPES = [
  { key: 'general',       name: '一般' },
  { key: 'purchasing',    name: '採購' },
  { key: 'communication', name: '聯絡溝通' },
  { key: 'field_work',    name: '現場工作' },
]

export default async function handler(req, res) {
  const supabase = createServerClient()
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })

  const { event_id } = req.query

  if (req.method === 'GET') {
    if (!event_id) return res.status(400).json({ error: 'event_id is required' })

    const { data, error } = await supabase
      .from('task_types')
      .select('*')
      .eq('event_id', event_id)
      .order('created_at', { ascending: true })

    if (error) return res.status(500).json({ error: error.message })

    // If no custom types seeded yet, seed defaults then return them
    if (!data || data.length === 0) {
      const rows = DEFAULT_TYPES.map((t) => ({
        event_id,
        name: t.name,
        created_by: session.user.id,
      }))
      const { data: seeded, error: seedErr } = await supabase
        .from('task_types')
        .insert(rows)
        .select()
      if (seedErr) return res.status(500).json({ error: seedErr.message })
      return res.status(200).json(seeded ?? [])
    }

    return res.status(200).json(data)
  }

  if (req.method === 'POST') {
    if (session.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' })

    const { name } = req.body
    if (!name?.trim() || !event_id) return res.status(400).json({ error: 'name and event_id required' })

    const { data, error } = await supabase
      .from('task_types')
      .insert({ event_id, name: name.trim(), created_by: session.user.id })
      .select().single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  res.setHeader('Allow', ['GET', 'POST'])
  res.status(405).end()
}
