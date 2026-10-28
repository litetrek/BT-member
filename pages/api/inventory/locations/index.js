import { query, insertInventoryLog } from '@/lib/db'
import { requireInventoryRole } from '@/lib/auth'
import { sortLocations } from '@/lib/inventoryLocationSort'
import { UNASSIGNED_LOCATION_CODE } from '@/lib/inventoryConstants'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const role = await requireInventoryRole(req, res, 'viewer')
    if (!role) return

    // lantern_count = records (筆), lantern_qty = units (盞, sum of QTY).
    const { rows } = await query(
      `SELECT l.*, COALESCE(lc.cnt, 0)::int AS lantern_count, COALESCE(lc.qty, 0)::int AS lantern_qty
       FROM inv_lantern_locations l
       LEFT JOIN (
         SELECT location_id, COUNT(*) AS cnt, SUM(qty) AS qty FROM inv_lantern_lanterns GROUP BY location_id
       ) lc ON lc.location_id = l.id`
    )
    return res.status(200).json(sortLocations(rows))
  }

  if (req.method === 'POST') {
    const role = await requireInventoryRole(req, res, 'admin')
    if (!role) return

    const { code, zone, description } = req.body
    if (!code || !zone) return res.status(400).json({ error: 'code and zone are required' })
    if (String(code).trim().toLowerCase() === UNASSIGNED_LOCATION_CODE) {
      return res.status(400).json({ error: `「${code}」為系統保留代碼 Reserved code` })
    }

    const email = req.inventoryEmail
    const { rows: [maxSort] } = await query('SELECT COALESCE(MAX(sort_order), -1) AS max FROM inv_lantern_locations')
    const { rows: [data] } = await query(
      `INSERT INTO inv_lantern_locations (code, zone, description, sort_order, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $5)
       RETURNING *`,
      [code, zone, description || null, maxSort.max + 1, email]
    )

    await insertInventoryLog({
      table_name:  'inv_lantern_locations',
      record_id:   data.id,
      record_name: data.code,
      action:      'created',
      user_email:  email,
    })

    return res.status(201).json(data)
  }

  res.setHeader('Allow', ['GET', 'POST'])
  res.status(405).end()
}
