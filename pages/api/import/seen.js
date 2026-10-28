import { query } from '@/lib/db'
import { importGuard } from '@/lib/importApi'

// POST /api/import/seen { event_id, keys: [msg_key] } → { seen: [msg_key] }
// Which messages were already imported into this event, so re-imports skip them.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).end()
  }
  const ctx = await importGuard(req, res, req.body?.event_id)
  if (!ctx) return

  const keys = Array.isArray(req.body?.keys) ? req.body.keys.filter((k) => typeof k === 'string').slice(0, 20000) : []
  if (!keys.length) return res.status(200).json({ seen: [] })

  const { rows } = await query(
    'SELECT msg_key FROM import_messages WHERE event_id = $1 AND msg_key = ANY($2)',
    [ctx.event.id, keys]
  )
  return res.status(200).json({ seen: rows.map((r) => r.msg_key) })
}
