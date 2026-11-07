import { query, insertInventoryLog } from '@/lib/db'
import { requireInventoryRole } from '@/lib/auth'
import { evaluateDisplayability } from '@/lib/inventoryEligibility'
import { getDisplayThresholds } from '@/lib/inventorySettings'
import { buildLanternUpdate } from '@/lib/inventoryLanternUpdate'
import { saveLanternUpdate } from '@/lib/inventoryLanternSave'
import { missingColumnError } from '@/lib/inventorySchema'

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

    const result = buildLanternUpdate(existing, req.body ?? {}, await getDisplayThresholds())
    if (result.error) return res.status(400).json({ error: result.error })
    const columnError = await missingColumnError(result.next)
    if (columnError) return res.status(400).json({ error: columnError })
    const data = await saveLanternUpdate({ existing, ...result, email: req.inventoryEmail })

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
