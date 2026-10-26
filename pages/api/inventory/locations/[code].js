import { query, insertInventoryLog } from '@/lib/db'
import { requireInventoryRole } from '@/lib/auth'

export default async function handler(req, res) {
  const { code } = req.query

  if (req.method === 'GET') {
    const role = await requireInventoryRole(req, res, 'viewer')
    if (!role) return

    const { rows: [location] } = await query(
      'SELECT * FROM inv_lantern_locations WHERE code = $1',
      [code]
    )
    if (!location) return res.status(404).json({ error: 'Location not found' })

    const { rows: lanterns } = await query(
      `SELECT l.*, c.name_zh AS category_name_zh, c.name_en AS category_name_en
       FROM inv_lantern_lanterns l
       LEFT JOIN inv_lantern_categories c ON c.id = l.category_id
       WHERE l.location_id = $1
       ORDER BY l.tag_id ASC`,
      [location.id]
    )

    return res.status(200).json({ ...location, lanterns })
  }

  if (req.method === 'PUT') {
    const role = await requireInventoryRole(req, res, 'admin')
    if (!role) return

    const { rows: [existing] } = await query(
      'SELECT * FROM inv_lantern_locations WHERE code = $1',
      [code]
    )
    if (!existing) return res.status(404).json({ error: 'Location not found' })

    const { zone, description, photo_url, photo_thumb_url } = req.body
    const email = req.inventoryEmail

    const { rows: [data] } = await query(
      `UPDATE inv_lantern_locations
       SET zone = $1, description = $2,
           photo_url = COALESCE($3, photo_url),
           photo_thumb_url = COALESCE($4, photo_thumb_url),
           updated_at = now(), updated_by = $5
       WHERE code = $6
       RETURNING *`,
      [
        zone ?? existing.zone,
        description ?? null,
        photo_url || null,
        photo_thumb_url || null,
        email,
        code,
      ]
    )

    await insertInventoryLog({
      table_name:  'inv_lantern_locations',
      record_id:   data.id,
      record_name: data.code,
      action:      'updated',
      user_email:  email,
    })

    return res.status(200).json(data)
  }

  res.setHeader('Allow', ['GET', 'PUT'])
  res.status(405).end()
}
