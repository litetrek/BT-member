import { query, insertInventoryLog } from '@/lib/db'
import { requireInventoryRole } from '@/lib/auth'
import { STATUS_OPTIONS, DISPLAY_DECISION_OPTIONS, CONDITION_OPTIONS } from '@/lib/inventoryConstants'
import { evaluateDisplayability } from '@/lib/inventoryEligibility'
import { getDisplayThresholds } from '@/lib/inventorySettings'
import { insertLanternEvent, diffLanternFields, pickEventType } from '@/lib/inventoryEvents'

// Nullable columns where an explicit '' / null in the body means "clear it". Before
// Phase 1 the PUT used `body.x ?? existing.x`, so choosing "—" (e.g. no location) in the
// edit form was silently ignored. A field absent from the body still keeps its value.
const NULLABLE_FIELDS = [
  'name_en', 'category_id', 'voltage', 'power_w', 'height_ft', 'width_ft', 'depth_ft',
  'location_id', 'notes', 'display_decision',
]

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

    const { reasons } = evaluateDisplayability(lantern, await getDisplayThresholds())
    return res.status(200).json({
      ...lantern, photos, log, inspections,
      displayable_reasons: lantern.displayable ? [] : reasons,
    })
  }

  if (req.method === 'PUT') {
    const role = await requireInventoryRole(req, res, 'editor')
    if (!role) return

    const { rows: [existing] } = await query('SELECT * FROM inv_lantern_lanterns WHERE tag_id = $1', [tagId])
    if (!existing) return res.status(404).json({ error: 'Lantern not found' })

    const body = req.body ?? {}
    const has = (f) => Object.prototype.hasOwnProperty.call(body, f)
    const pick = (f) => {
      if (!has(f)) return existing[f]
      if (NULLABLE_FIELDS.includes(f)) return body[f] === '' || body[f] === undefined ? null : body[f]
      return body[f] ?? existing[f]
    }

    const next = {
      name_zh: pick('name_zh'), name_en: pick('name_en'), category_id: pick('category_id'),
      qty: pick('qty'), voltage: pick('voltage'), power_w: pick('power_w'),
      height_ft: pick('height_ft'), width_ft: pick('width_ft'), depth_ft: pick('depth_ft'),
      location_id: pick('location_id'), condition: pick('condition'),
      cloth_damage_pct: pick('cloth_damage_pct'), frame_damage_pct: pick('frame_damage_pct'),
      notes: pick('notes'), status: pick('status'), display_decision: pick('display_decision'),
      label_attached: pick('label_attached'),
    }

    next.name_zh = String(next.name_zh ?? '').trim()
    next.name_en = next.name_en == null ? null : (String(next.name_en).trim() || null)
    if (!next.name_zh) return res.status(400).json({ error: '請填寫中文名稱 Name (ZH) is required' })
    if (!STATUS_OPTIONS.includes(next.status)) return res.status(400).json({ error: 'Invalid status' })
    if (!CONDITION_OPTIONS.includes(next.condition)) return res.status(400).json({ error: 'Invalid condition' })
    if (next.display_decision !== null && !DISPLAY_DECISION_OPTIONS.includes(next.display_decision)) {
      return res.status(400).json({ error: 'Invalid display_decision' })
    }

    const { displayable } = evaluateDisplayability(next, await getDisplayThresholds())
    const email = req.inventoryEmail

    // Only block a *new* Selected on a non-displayable lantern; a lantern that was already
    // Selected (e.g. before an admin tightened the thresholds) can still be edited.
    if (next.display_decision === 'Selected' && !displayable && existing.display_decision !== 'Selected') {
      return res.status(400).json({ error: '不可展示的燈籠不能設為 Selected Cannot select a non-displayable lantern' })
    }

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
        next.name_zh, next.name_en, next.category_id, next.qty, next.voltage, next.power_w,
        next.height_ft, next.width_ft, next.depth_ft, next.location_id,
        next.condition, next.cloth_damage_pct, next.frame_damage_pct, displayable,
        next.notes, next.status, next.display_decision, next.label_attached,
        email, tagId,
      ]
    )

    await insertInventoryLog({
      table_name:  'inv_lantern_lanterns',
      record_id:   data.id,
      record_name: `${data.tag_id} ${data.name_zh}`,
      action:      'updated',
      user_email:  email,
    })
    const changes = diffLanternFields(existing, data)
    if (Object.keys(changes).length) {
      await insertLanternEvent({ lantern_id: data.id, event_type: pickEventType(changes), actor: email, changes })
    }

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
