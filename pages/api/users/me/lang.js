import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT'])
    return res.status(405).end()
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })

  const { lang } = req.body
  if (!['en', 'zh'].includes(lang)) {
    return res.status(400).json({ error: 'lang must be en or zh' })
  }

  const supabase = createServerClient()
  const { error } = await supabase
    .from('users')
    .update({ lang })
    .eq('id', session.user.id)

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ ok: true })
}
