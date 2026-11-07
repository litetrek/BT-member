// Server-only: write a validated lantern edit (from buildLanternUpdate) to Neon, plus the
// activity log and the inv_lantern_events diff. Used by the single-lantern PUT and the
// table view's batch save.
import { query, insertInventoryLog } from '@/lib/db'
import { insertLanternEvent, diffLanternFields, pickEventType } from '@/lib/inventoryEvents'
import { hasRepairEaseColumn, hasBaseTypeColumn, hasSizeClassColumn } from '@/lib/inventorySchema'

export async function saveLanternUpdate({ existing, next, displayable, email }) {
  // Columns added by scripts/migrate-lantern-fields.js — skipped until it has run on Neon.
  const optional = [
    ...((await hasRepairEaseColumn()) ? [['repair_ease', next.repair_ease]] : []),
    ...((await hasBaseTypeColumn()) ? [['base_type', next.base_type]] : []),
    ...((await hasSizeClassColumn()) ? [['size_class', next.size_class]] : []),
  ]

  const { rows: [data] } = await query(
    `UPDATE inv_lantern_lanterns SET
       name_zh = $1, name_en = $2, category_id = $3, qty = $4, voltage = $5, power_w = $6,
       height_ft = $7, width_ft = $8, depth_ft = $9, location_id = $10,
       condition = $11, cloth_damage_pct = $12, frame_damage_pct = $13, displayable = $14,
       notes = $15, status = $16, display_decision = $17, label_attached = $18,
       updated_at = now(), updated_by = $19${optional.map(([c], i) => `, ${c} = $${21 + i}`).join('')}
     WHERE id = $20
     RETURNING *`,
    [
      next.name_zh, next.name_en, next.category_id, next.qty, next.voltage, next.power_w,
      next.height_ft, next.width_ft, next.depth_ft, next.location_id,
      next.condition, next.cloth_damage_pct, next.frame_damage_pct, displayable,
      next.notes, next.status, next.display_decision, next.label_attached,
      email, existing.id, ...optional.map(([, v]) => v),
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
  return data
}
