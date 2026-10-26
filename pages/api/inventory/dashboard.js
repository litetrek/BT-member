import { query } from '@/lib/db'
import { requireInventoryRole } from '@/lib/auth'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).end()
  }

  const role = await requireInventoryRole(req, res, 'viewer')
  if (!role) return

  const [totals, byCondition, byCategory, byVoltage, byLocation] = await Promise.all([
    query('SELECT COUNT(*)::int AS records, COALESCE(SUM(qty), 0)::int AS qty FROM inv_lantern_lanterns'),
    query('SELECT condition, COUNT(*)::int AS count FROM inv_lantern_lanterns GROUP BY condition ORDER BY condition'),
    query(
      `SELECT c.id, c.name_zh, c.name_en, COUNT(l.id)::int AS count,
              ROUND(AVG(l.cloth_damage_pct))::int AS avg_cloth_damage_pct,
              ROUND(AVG(l.frame_damage_pct))::int AS avg_frame_damage_pct
       FROM inv_lantern_categories c
       LEFT JOIN inv_lantern_lanterns l ON l.category_id = c.id
       GROUP BY c.id, c.name_zh, c.name_en, c.sort_order
       ORDER BY c.sort_order`
    ),
    query(
      `SELECT COALESCE(voltage, '—') AS voltage, COUNT(*)::int AS count
       FROM inv_lantern_lanterns GROUP BY voltage ORDER BY voltage`
    ),
    query(
      `SELECT loc.code, COUNT(l.id)::int AS count
       FROM inv_lantern_locations loc
       JOIN inv_lantern_lanterns l ON l.location_id = loc.id
       GROUP BY loc.code
       HAVING COUNT(l.id) > 0
       ORDER BY count DESC, loc.code`
    ),
  ])

  return res.status(200).json({
    totalRecords: totals.rows[0].records,
    totalQty: totals.rows[0].qty,
    byCondition: byCondition.rows,
    byCategory: byCategory.rows,
    byVoltage: byVoltage.rows,
    byLocation: byLocation.rows,
  })
}
