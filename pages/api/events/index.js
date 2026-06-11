import { createServerClient } from '@/lib/supabase/server'

export default async function handler(req, res) {
  const supabase = createServerClient()

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('event_date', { ascending: false })

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'POST') {
    const { name, slug, event_date, status } = req.body
    const { data, error } = await supabase
      .from('events')
      .insert({ name, slug, event_date, status: status ?? 'active' })
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  res.setHeader('Allow', ['GET', 'POST'])
  res.status(405).end()
}
