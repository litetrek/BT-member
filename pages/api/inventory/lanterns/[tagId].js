import { query, insertInventoryLog } from '@/lib/db'
import { requireInventoryRole } from '@/lib/auth'
import { computeDisplayable } from '@/lib/inventoryConstants'

export default async function handler(req, res) {
  const { tagId } = req.query

  if (req.method === 'GET') {
    const role = await requireInventoryRole(req, res, 'viewer')
    if (!role) return

    const { rows: [lantern] } = await query(
      `SELECT l.*,
              c.name_zh AS category_name_zh, c.name_en AS category_name_en,
              loc.code AS location_code
       FROM inv_lantern_lanterns l
       LEFT JOIN inv_lantern_categories c ON c.id = l.category_id
       LEFT JOIN inv_lantern_locations loc ON loc.id = l.location_id
       WHERE l.tag_id = $1`,
      [tagId]
    )
    if (!lantern) return res.status(404).json({ error: 'Lantern not found' })

    const { rows: photos } = await query(
      `SELECT * FROM inv_lantern_photos WHERE owner_type = 'lantern' AND owner_id = $1
       ORDER BY is_primary DESC, taken_at ASC`,
      [lantern.id]
    )

    const { rows: log } = await query(
      `SELECT * FROM inv_lantern_activity_log WHERE record_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [lantern.id]
    )

    const { rows: inspections } = await query(
      `SELECT i.*, loc.code AS location_code
       FROM inv_lantern_inspections i
       LEFT JOIN inv_lantern_locations loc ON loc.id = i.location_id
       WHERE i.lantern_id = $1
       ORDER BY i.inspected_at DESC`,
      [lantern.id]
    )

    return res.status(200).json({ ...lantern, photos, log, inspections })
  }

  if (req.method === 'PUT') {
    const role = await requireInventoryRole(req, res, 'editor')
    if (!role) return

    const { rows: [existing] } = await query('SELECT * FROM inv_lantern_lanterns WHERE tag_id = $1', [tagId])
    if (!existing) return res.status(404).json({ error: 'Lantern not found' })

    const {
      name_zh, name_en, category_id, qty, voltage, power_w,
      height_ft, width_ft, depth_ft, location_id,
      condition, cloth_damage_pct, frame_damage_pct, notes,
      status, display_decision, label_attached,
    } = req.body

    const cloth = cloth_damage_pct ?? existing.cloth_damage_pct
    const frame = frame_damage_pct ?? existing.frame_damage_pct
    const displayable = computeDisplayable(cloth, frame)
    const email = req.inventoryEmail

    // Only admin/editor may edit (already gated above); display_decision + label_attached
    // are admin-level fields per the spec's management flow, but Stage 2 keeps this simple —
    // Stage 4 will tighten permissions around display_decision once that screen ships.
    const { rows: [data] } = await query(
      `UPDATE inv_lantern_lanterns SET
         name_zh = $1, name_en = $2, category_id = $3, qty = $4, voltage = $5, power_w = $6,
         height_ft = $7, width_ft = $8, depth_ft = $9, location_id = $10,
         condition = $11, cloth_damage_pct = $12, frame_damage_pct = $13, displayable = $14,
         notes = $15, status = $16, display_decision = $17, label_attached = $18,
         updated_at = now(), updated_by = $19
       WHERE tag_id = $20
       RETURNING *`,
      [
        name_zh ?? existing.name_zh,
        name_en ?? existing.name_en,
        category_id ?? existing.category_id,
        qty ?? existing.qty,
        voltage ?? existing.voltage,
        power_w ?? existing.power_w,
        height_ft ?? existing.height_ft,
        width_ft ?? existing.width_ft,
        depth_ft ?? existing.depth_ft,
        location_id ?? existing.location_id,
        condition ?? existing.condition,
        cloth,
        frame,
        displayable,
        notes ?? existing.notes,
        status ?? existing.status,
        display_decision ?? existing.display_decision,
        label_attached ?? existing.label_attached,
        email,
        tagId,
      ]
    )

    await insertInventoryLog({
      table_name:  'inv_lantern_lanterns',
      record_id:   data.id,
      record_name: `${data.tag_id} ${data.name_zh}`,
      action:      'updated',
      user_email:  email,
    })

    return res.status(200).json(data)
  }

  if (req.method === 'DELETE') {
    const role = await requireInventoryRole(req, res, 'admin')
    if (!role) return

    const { rows: [existing] } = await query('SELECT * FROM inv_lantern_lanterns WHERE tag_id = $1', [tagId])
    if (!existing) return res.status(404).json({ error: 'Lantern not found' })

    await query(`DELETE FROM inv_lantern_photos WHERE owner_type = 'lantern' AND owner_id = $1`, [existing.id])
    await query('DELETE FROM inv_lantern_lanterns WHERE id = $1', [existing.id])

    await insertInventoryLog({
      table_name:  'inv_lantern_lanterns',
      record_id:   existing.id,
      record_name: `${existing.tag_id} ${existing.name_zh}`,
      action:      'deleted',
      user_email:  req.inventoryEmail,
    })

    return res.status(204).end()
  }

  res.setHeader('Allow', ['GET', 'PUT', 'DELETE'])
  res.status(405).end()
}
