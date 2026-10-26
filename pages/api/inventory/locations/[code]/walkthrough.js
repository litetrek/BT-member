import { query, insertInventoryLog } from '@/lib/db'
import { requireInventoryRole } from '@/lib/auth'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end()
  }

  const role = await requireInventoryRole(req, res, 'editor')
  if (!role) return

  const { code } = req.query
  const { rows: [data] } = await query(
    `UPDATE inv_lantern_locations SET last_walkthrough_at = now(), updated_at = now(), updated_by = $1
     WHERE code = $2
     RETURNING *`,
    [req.inventoryEmail, code]
  )
  if (!data) return res.status(404).json({ error: 'Location not found' })

  await insertInventoryLog({
    table_name:  'inv_lantern_locations',
    record_id:   data.id,
    record_name: data.code,
    action:      'walkthrough_done',
    user_email:  req.inventoryEmail,
  })

  return res.status(200).json(data)
}
