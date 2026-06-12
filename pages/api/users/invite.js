import { createServerClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).end()
  }

  if (await requireAdmin(req, res)) return

  const supabase = createServerClient()
  const { email, role = 'member', event_id } = req.body
  if (!email || !event_id) return res.status(400).json({ error: 'email and event_id required' })

  // Look up or create placeholder user
  let { data: user } = await supabase.from('users').select('id').eq('email', email).single()

  if (!user) {
    const { data: newUser, error: createErr } = await supabase
      .from('users')
      .insert({ email, name: null })
      .select('id')
      .single()
    if (createErr) return res.status(500).json({ error: createErr.message })
    user = newUser
  }

  // Add/update event membership
  const { error } = await supabase
    .from('event_members')
    .upsert({ event_id, user_id: user.id, role }, { onConflict: 'event_id,user_id' })
  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ ok: true })
}
