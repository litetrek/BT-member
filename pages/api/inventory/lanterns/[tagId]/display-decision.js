import { query, insertInventoryLog } from '@/lib/db'
import { requireInventoryRole } from '@/lib/auth'
import { DISPLAY_DECISION_OPTIONS } from '@/lib/inventoryConstants'

// Separate from the general PUT /api/inventory/lanterns/[tagId] route on purpose: per the
// spec's role table, Viewers may "mark display decisions" but nothing else about a
// lantern — this endpoint only ever touches display_decision.
export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'PUT')
    return res.status(405).end()
  }

  const role = await requireInventoryRole(req, res, 'viewer')
  if (!role) return

  const { tagId } = req.query
  const { display_decision } = req.body
  if (display_decision !== null && !DISPLAY_DECISION_OPTIONS.includes(display_decision)) {
    return res.status(400).json({ error: 'Invalid display_decision' })
  }

  const { rows: [existing] } = await query('SELECT id, tag_id, name_zh, displayable FROM inv_lantern_lanterns WHERE tag_id = $1', [tagId])
  if (!existing) return res.status(404).json({ error: 'Lantern not found' })
  if (display_decision === 'Selected' && !existing.displayable) {
    return res.status(400).json({ error: 'Cannot select a non-displayable lantern' })
  }

  const email = req.inventoryEmail
  const { rows: [data] } = await query(
    `UPDATE inv_lantern_lanterns SET display_decision = $1, updated_at = now(), updated_by = $2
     WHERE tag_id = $3 RETURNING *`,
    [display_decision || null, email, tagId]
  )

  await insertInventoryLog({
    table_name:    'inv_lantern_lanterns',
    record_id:     existing.id,
    record_name:   `${existing.tag_id} ${existing.name_zh}`,
    action:        'display_decision_changed',
    new_value:     display_decision || null,
    user_email:    email,
  })

  return res.status(200).json(data)
}
