import { query, insertInventoryLog } from '@/lib/db'
import { requireInventoryRole } from '@/lib/auth'
import { computeDisplayable } from '@/lib/inventoryConstants'

// Saving an inspection updates the lantern's current condition, damage % and
// location in the same flow. If location_id differs from the lantern's existing
// location, that's an auto-move — logged separately from the inspection itself.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end()
  }

  const role = await requireInventoryRole(req, res, 'editor')
  if (!role) return

  const { lantern_id, location_id, condition, cloth_damage_pct, frame_damage_pct, notes } = req.body
  if (!lantern_id || !condition) {
    return res.status(400).json({ error: 'lantern_id and condition are required' })
  }

  const { rows: [lantern] } = await query('SELECT * FROM inv_lantern_lanterns WHERE id = $1', [lantern_id])
  if (!lantern) return res.status(404).json({ error: 'Lantern not found' })

  const cloth = cloth_damage_pct ?? lantern.cloth_damage_pct
  const frame = frame_damage_pct ?? lantern.frame_damage_pct
  const displayable = computeDisplayable(cloth, frame)
  const newLocationId = location_id || lantern.location_id
  const email = req.inventoryEmail

  const { rows: [inspection] } = await query(
    `INSERT INTO inv_lantern_inspections
       (lantern_id, inspected_by, condition, cloth_damage_pct, frame_damage_pct, location_id, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [lantern_id, email, condition, cloth, frame, newLocationId || null, notes || null]
  )

  const { rows: [updatedLantern] } = await query(
    `UPDATE inv_lantern_lanterns
     SET condition = $1, cloth_damage_pct = $2, frame_damage_pct = $3, displayable = $4,
         location_id = $5, updated_at = now(), updated_by = $6
     WHERE id = $7
     RETURNING *`,
    [condition, cloth, frame, displayable, newLocationId || null, email, lantern_id]
  )

  await insertInventoryLog({
    table_name:  'inv_lantern_lanterns',
    record_id:   lantern.id,
    record_name: `${lantern.tag_id} ${lantern.name_zh}`,
    action:      'inspected',
    new_value:   condition,
    user_email:  email,
  })

  if (newLocationId && newLocationId !== lantern.location_id) {
    const { rows: [oldLoc] } = lantern.location_id
      ? await query('SELECT code FROM inv_lantern_locations WHERE id = $1', [lantern.location_id])
      : { rows: [null] }
    const { rows: [newLoc] } = await query('SELECT code FROM inv_lantern_locations WHERE id = $1', [newLocationId])

    await insertInventoryLog({
      table_name:    'inv_lantern_lanterns',
      record_id:     lantern.id,
      record_name:   `${lantern.tag_id} ${lantern.name_zh}`,
      action:        'moved',
      field_changed: 'location_id',
      old_value:     oldLoc?.code ?? null,
      new_value:     newLoc?.code ?? null,
      user_email:    email,
    })
  }

  return res.status(201).json({ inspection, lantern: updatedLantern })
}
