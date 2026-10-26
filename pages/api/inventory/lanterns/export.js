import { query } from '@/lib/db'
import { requireInventoryRole } from '@/lib/auth'
import { buildLanternWhere } from '@/lib/inventoryLanternFilters'

const BASE_COLUMNS = [
  'tag_id', 'name_zh', 'name_en', 'category', 'qty', 'voltage', 'power_w',
  'height_ft', 'width_ft', 'depth_ft', 'location', 'condition',
  'cloth_damage_pct', 'frame_damage_pct', 'displayable', 'status',
  'display_decision', 'notes',
]

function csvEscape(value) {
  if (value === null || value === undefined) return ''
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// Excel and Google Sheets both evaluate a CSV cell starting with "=" as a formula on
// open, so a HYPERLINK() formula renders as an actual clickable link — plain CSV has no
// other way to express that. Safe here because the URL always comes from our own Blob
// storage, never from free-text user input.
function hyperlink(url) {
  return url ? `=HYPERLINK("${url}")` : ''
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
            (SELECT array_agg(p2.url ORDER BY p2.is_primary DESC, p2.taken_at ASC)
             FROM inv_lantern_photos p2
             WHERE p2.owner_type = 'lantern' AND p2.owner_id = l.id) AS photo_url_list
     FROM inv_lantern_lanterns l
     LEFT JOIN inv_lantern_categories c ON c.id = l.category_id
     LEFT JOIN inv_lantern_locations loc ON loc.id = l.location_id
     ${whereSql}
     ORDER BY l.tag_id ASC`,
    params
  )

  const maxPhotos = rows.reduce((max, r) => Math.max(max, (r.photo_url_list ?? []).length), 0)
  const photoColumns = Array.from({ length: maxPhotos }, (_, i) => `photo_${i + 1}`)
  const columns = [...BASE_COLUMNS, 'primary_photo_url', ...photoColumns]

  const lines = [columns.join(',')]
  for (const row of rows) {
    const urls = row.photo_url_list ?? []
    const cells = [
      ...BASE_COLUMNS.map((col) => csvEscape(row[col])),
      csvEscape(hyperlink(row.primary_photo_url)),
      ...photoColumns.map((_, i) => csvEscape(hyperlink(urls[i]))),
    ]
    lines.push(cells.join(','))
  }
  const csv = '﻿' + lines.join('\r\n') // BOM so Excel renders zh correctly

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="lanterns-${new Date().toISOString().slice(0, 10)}.csv"`)
  return res.status(200).send(csv)
}
