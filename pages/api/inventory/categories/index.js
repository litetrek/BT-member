import { query } from '@/lib/db'
import { requireInventoryRole } from '@/lib/auth'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).end()
  }

  const role = await requireInventoryRole(req, res, 'viewer')
  if (!role) return

  const { rows } = await query(
    'SELECT * FROM inv_lantern_categories ORDER BY sort_order ASC'
  )
  return res.status(200).json(rows)
}
