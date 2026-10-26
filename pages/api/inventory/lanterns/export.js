import { query } from '@/lib/db'
import { requireInventoryRole } from '@/lib/auth'
import { buildLanternWhere } from '@/lib/inventoryLanternFilters'

const COLUMNS = [
  'tag_id', 'name_zh', 'name_en', 'category', 'qty', 'voltage', 'power_w',
  'height_ft', 'width_ft', 'depth_ft', 'location', 'condition',
  'cloth_damage_pct', 'frame_damage_pct', 'displayable', 'status',
  'display_decision', 'notes', 'primary_photo_url', 'photo_urls',
]

function csvEscape(value) {
  if (value === null || value === undefined) return ''
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).end()
  }

  const role = await requireInventoryRole(req, res, 'viewer')
  if (!role) return

  const { whereSql, params } = buildLanternWhere(req.query)

  const { rows } = await query(
    `SELECT l.tag_id, l.name_zh, l.name_en, c.name_zh AS category, l.qty, l.voltage, l.power_w,
            l.height_ft, l.width_ft, l.depth_ft, loc.code AS location, l.condition,
            l.cloth_damage_pct, l.frame_damage_pct, l.displayable, l.status,
            l.display_decision, l.notes,
            (SELECT p.url FROM inv_lantern_photos p
             WHERE p.owner_type = 'lantern' AND p.owner_id = l.id AND p.is_primary = true
             LIMIT 1) AS primary_photo_url,
            (SELECT string_agg(p2.url, ' | ' ORDER BY p2.is_primary DESC, p2.taken_at ASC)
             FROM inv_lantern_photos p2
             WHERE p2.owner_type = 'lantern' AND p2.owner_id = l.id) AS photo_urls
     FROM inv_lantern_lanterns l
     LEFT JOIN inv_lantern_categories c ON c.id = l.category_id
     LEFT JOIN inv_lantern_locations loc ON loc.id = l.location_id
     ${whereSql}
     ORDER BY l.tag_id ASC`,
    params
  )

  const lines = [COLUMNS.join(',')]
  for (const row of rows) {
    lines.push(COLUMNS.map((col) => csvEscape(row[col])).join(','))
  }
  const csv = '﻿' + lines.join('\r\n') // BOM so Excel renders zh correctly

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="lanterns-${new Date().toISOString().slice(0, 10)}.csv"`)
  return res.status(200).send(csv)
}
