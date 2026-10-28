import { query, insertInventoryLog } from '@/lib/db'
import { requireInventoryRole } from '@/lib/auth'
import { getDisplayThresholds, setDisplayThresholds } from '@/lib/inventorySettings'
import { insertLanternEvent } from '@/lib/inventoryEvents'

// GET  (viewer+) → { thresholds: { cloth_pct, frame_pct } }
// PUT  (admin)   ← { thresholds: { cloth_pct, frame_pct } } → saves, then recomputes the
//                  stored `displayable` flag on every lantern so badges, filters and the
//                  Fair shortlist reflect the new rule immediately. Returns { thresholds, changed }.
export default async function handler(req, res) {
  if (req.method === 'GET') {
    const role = await requireInventoryRole(req, res, 'viewer')
    if (!role) return
    return res.status(200).json({ thresholds: await getDisplayThresholds() })
  }

  if (req.method === 'PUT') {
    const role = await requireInventoryRole(req, res, 'admin')
    if (!role) return

    const input = req.body?.thresholds ?? {}
    const thresholds = {}
    for (const field of ['cloth_pct', 'frame_pct']) {
      const n = Number(input[field])
      if (!Number.isInteger(n) || n < 1 || n > 100) {
        return res.status(400).json({ error: '門檻須為 1–100 的整數 Thresholds must be whole numbers 1–100' })
      }
      thresholds[field] = n
    }

    const before = await getDisplayThresholds()
    const email = req.inventoryEmail
    await setDisplayThresholds(thresholds, email)

    // Same rule as evaluateDisplayability() in lib/inventoryEligibility.js — keep in sync.
    const { rows: changed } = await query(
      `UPDATE inv_lantern_lanterns
       SET displayable = (cloth_damage_pct < $1 AND frame_damage_pct < $2),
           updated_at = now(), updated_by = $3
       WHERE displayable IS DISTINCT FROM (cloth_damage_pct < $1 AND frame_damage_pct < $2)
       RETURNING id, displayable`,
      [thresholds.cloth_pct, thresholds.frame_pct, email]
    )
    const note = `展示門檻變更 Threshold change: 布面 ${before.cloth_pct}→${thresholds.cloth_pct}%, 骨架 ${before.frame_pct}→${thresholds.frame_pct}%`
    for (const row of changed) {
      await insertLanternEvent({
        lantern_id: row.id, event_type: 'updated', actor: email, note,
        changes: { displayable: [!row.displayable, row.displayable] },
      })
    }

    await insertInventoryLog({
      table_name:  'inv_lantern_settings',
      record_name: 'display_thresholds',
      action:      'updated',
      old_value:   JSON.stringify(before),
      new_value:   JSON.stringify(thresholds),
      user_email:  email,
    })

    return res.status(200).json({ thresholds, changed: changed.length })
  }

  res.setHeader('Allow', ['GET', 'PUT'])
  res.status(405).end()
}
