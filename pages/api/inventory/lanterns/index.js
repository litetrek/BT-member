import { query, insertInventoryLog } from '@/lib/db'
import { requireInventoryRole } from '@/lib/auth'
import { computeDisplayable } from '@/lib/inventoryConstants'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const role = await requireInventoryRole(req, res, 'viewer')
    if (!role) return

    const { q, category_id, location_id, voltage, condition, displayable, status, display_decision } = req.query

    const where = []
    const params = []

    if (q) {
      params.push(`%${q}%`)
      const p = `$${params.length}`
      where.push(`(l.tag_id ILIKE ${p} OR l.name_zh ILIKE ${p} OR l.name_en ILIKE ${p})`)
    }
    if (category_id)      { params.push(category_id);      where.push(`l.category_id = $${params.length}`) }
    if (location_id)      { params.push(location_id);      where.push(`l.location_id = $${params.length}`) }
    if (voltage)          { params.push(voltage);          where.push(`l.voltage = $${params.length}`) }
    if (condition)        { params.push(condition);        where.push(`l.condition = $${params.length}`) }
    if (status)           { params.push(status);           where.push(`l.status = $${params.length}`) }
    if (display_decision) { params.push(display_decision); where.push(`l.display_decision = $${params.length}`) }
    if (displayable === 'true' || displayable === 'false') {
      params.push(displayable === 'true')
      where.push(`l.displayable = $${params.length}`)
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const { rows } = await query(
      `SELECT l.*,
              c.name_zh AS category_name_zh, c.name_en AS category_name_en,
              loc.code AS location_code,
              p.thumb_url AS primary_photo_thumb_url
       FROM inv_lantern_lanterns l
       LEFT JOIN inv_lantern_categories c ON c.id = l.category_id
       LEFT JOIN inv_lantern_locations loc ON loc.id = l.location_id
       LEFT JOIN inv_lantern_photos p ON p.owner_type = 'lantern' AND p.owner_id = l.id AND p.is_primary = true
       ${whereSql}
       ORDER BY l.tag_id ASC`,
      params
    )
    return res.status(200).json(rows)
  }

  if (req.method === 'POST') {
    const role = await requireInventoryRole(req, res, 'editor')
    if (!role) return

    const {
      name_zh, name_en, category_id, qty, voltage, power_w,
      height_ft, width_ft, depth_ft, location_id,
      condition, cloth_damage_pct, frame_damage_pct, notes,
    } = req.body

    if (!name_zh) return res.status(400).json({ error: 'name_zh is required' })

    const cloth = cloth_damage_pct ?? 0
    const frame = frame_damage_pct ?? 0
    const displayable = computeDisplayable(cloth, frame)
    const email = req.inventoryEmail

    const { rows: [data] } = await query(
      `INSERT INTO inv_lantern_lanterns
         (name_zh, name_en, category_id, qty, voltage, power_w, height_ft, width_ft, depth_ft,
          location_id, condition, cloth_damage_pct, frame_damage_pct, displayable, notes,
          created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16)
       RETURNING *`,
      [
        name_zh, name_en || null, category_id || null, qty || 1, voltage || null, power_w || null,
        height_ft || null, width_ft || null, depth_ft || null,
        location_id || null, condition || 'Good', cloth, frame, displayable, notes || null,
        email,
      ]
    )

    await insertInventoryLog({
      table_name:  'inv_lantern_lanterns',
      record_id:   data.id,
      record_name: `${data.tag_id} ${data.name_zh}`,
      action:      'created',
      user_email:  email,
    })

    return res.status(201).json(data)
  }

  res.setHeader('Allow', ['GET', 'POST'])
  res.status(405).end()
}
