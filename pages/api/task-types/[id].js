import { createServerClient } from '@/lib/supabase/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Default type names — cannot be deleted
const DEFAULT_NAMES = ['一般', '採購', '聯絡溝通', '現場工作']

export default async function handler(req, res) {
  const supabase = createServerClient()
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  if (session.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' })

  const { id } = req.query

  if (req.method === 'DELETE') {
    const { data: existing, error: fetchErr } = await supabase
      .from('task_types')
      .select('name')
      .eq('id', id)
      .single()

    if (fetchErr) return res.status(404).json({ error: '找不到此類型' })
    if (DEFAULT_NAMES.includes(existing.name)) {
      return res.status(400).json({ error: '無法刪除預設類型' })
    }

    const { error } = await supabase.from('task_types').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(204).end()
  }

  res.setHeader('Allow', ['DELETE'])
  res.status(405).end()
}
