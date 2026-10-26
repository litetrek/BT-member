import { query, insertInventoryLog } from '@/lib/db'
import { requireInventoryRole } from '@/lib/auth'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const role = await requireInventoryRole(req, res, 'viewer')
    if (!role) return

    const { rows } = await query(
      'SELECT * FROM inv_lantern_categories ORDER BY sort_order ASC'
    )
    return res.status(200).json(rows)
  }

  if (req.method === 'POST') {
    const role = await requireInventoryRole(req, res, 'admin')
    if (!role) return

    const { name_zh, name_en } = req.body
    if (!name_zh || !name_en) return res.status(400).json({ error: 'name_zh and name_en are required' })

    const { rows: [maxSort] } = await query('SELECT COALESCE(MAX(sort_order), -1) AS max FROM inv_lantern_categories')
    const { rows: [data] } = await query(
      `INSERT INTO inv_lantern_categories (name_zh, name_en, sort_order)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name_zh, name_en, maxSort.max + 1]
    )

    await insertInventoryLog({
      table_name:  'inv_lantern_categories',
      record_id:   data.id,
      record_name: `${data.name_zh} / ${data.name_en}`,
      action:      'created',
      user_email:  req.inventoryEmail,
    })

    return res.status(201).json(data)
  }

  res.setHeader('Allow', ['GET', 'POST'])
  res.status(405).end()
}
