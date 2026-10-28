import { query, insertInventoryLog } from '@/lib/db'
import { requireInventoryRole } from '@/lib/auth'
import { UNASSIGNED_LOCATION_CODE, UNASSIGNED_LABEL } from '@/lib/inventoryConstants'

export default async function handler(req, res) {
  const { code } = req.query

  if (req.method === 'GET') {
    const role = await requireInventoryRole(req, res, 'viewer')
    if (!role) return

    // Pseudo-location: every lantern with no location_id (Phase 1.3). Read-only — PUT and
    // DELETE fall through to the normal 404 since no row has this code.
    if (code === UNASSIGNED_LOCATION_CODE) {
      const { rows: lanterns } = await query(
        `SELECT l.*, c.name_zh AS category_name_zh, c.name_en AS category_name_en
         FROM inv_lantern_lanterns l
         LEFT JOIN inv_lantern_categories c ON c.id = l.category_id
         WHERE l.location_id IS NULL
         ORDER BY l.tag_id ASC`
      )
      return res.status(200).json({
        id: null, code: UNASSIGNED_LOCATION_CODE, zone: null, is_unassigned: true,
        description: `${UNASSIGNED_LABEL} — 尚未指定存放地點的燈籠`,
        photo_url: null, photo_thumb_url: null, last_walkthrough_at: null,
        lanterns,
      })
    }

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

  if (req.method === 'DELETE') {
    const role = await requireInventoryRole(req, res, 'admin')
    if (!role) return

    const { rows: [existing] } = await query(
      'SELECT * FROM inv_lantern_locations WHERE code = $1',
      [code]
    )
    if (!existing) return res.status(404).json({ error: 'Location not found' })

    // Only empty locations can be deleted — never orphan lanterns implicitly.
    const { rows: [{ count }] } = await query(
      'SELECT COUNT(*)::int AS count FROM inv_lantern_lanterns WHERE location_id = $1',
      [existing.id]
    )
    if (count > 0) {
      return res.status(409).json({ error: `此地點仍有 ${count} 筆燈籠，請先移走 Location still has lanterns` })
    }

    // Past inspections keep their lantern/condition history; only the link to
    // this location is cleared (FK would otherwise block the delete).
    await query('UPDATE inv_lantern_inspections SET location_id = NULL WHERE location_id = $1', [existing.id])
    await query("DELETE FROM inv_lantern_photos WHERE owner_type = 'location' AND owner_id = $1", [existing.id])
    const { rowCount } = await query(
      `DELETE FROM inv_lantern_locations
       WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM inv_lantern_lanterns WHERE location_id = $1)`,
      [existing.id]
    )
    if (!rowCount) return res.status(409).json({ error: '此地點仍有燈籠 Location still has lanterns' })

    await insertInventoryLog({
      table_name:  'inv_lantern_locations',
      record_id:   existing.id,
      record_name: existing.code,
      action:      'deleted',
      user_email:  req.inventoryEmail,
    })

    return res.status(200).json({ ok: true })
  }

  res.setHeader('Allow', ['GET', 'PUT', 'DELETE'])
  res.status(405).end()
}
