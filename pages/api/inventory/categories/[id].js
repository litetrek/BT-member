import { query, insertInventoryLog } from '@/lib/db'
import { requireInventoryRole } from '@/lib/auth'

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'PUT')
    return res.status(405).end()
  }

  const role = await requireInventoryRole(req, res, 'admin')
  if (!role) return

  const { id } = req.query
  const { rows: [existing] } = await query('SELECT * FROM inv_lantern_categories WHERE id = $1', [id])
  if (!existing) return res.status(404).json({ error: 'Category not found' })

  const { name_zh, name_en, sort_order } = req.body
  const { rows: [data] } = await query(
    `UPDATE inv_lantern_categories SET name_zh = $1, name_en = $2, sort_order = $3
     WHERE id = $4
     RETURNING *`,
    [
      name_zh ?? existing.name_zh,
      name_en ?? existing.name_en,
      sort_order ?? existing.sort_order,
      id,
    ]
  )

  await insertInventoryLog({
    table_name:  'inv_lantern_categories',
    record_id:   data.id,
    record_name: `${data.name_zh} / ${data.name_en}`,
    action:      'updated',
    user_email:  req.inventoryEmail,
  })

  return res.status(200).json(data)
}
