import { query, insertInventoryLog } from '@/lib/db'
import { requireInventoryRole } from '@/lib/auth'
import { CONDITION_OPTIONS } from '@/lib/inventoryConstants'
import { buildLanternWhere } from '@/lib/inventoryLanternFilters'
import { evaluateDisplayability } from '@/lib/inventoryEligibility'
import { getDisplayThresholds } from '@/lib/inventorySettings'
import { logLanternChange } from '@/lib/inventoryEvents'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const role = await requireInventoryRole(req, res, 'viewer')
    if (!role) return

    const { whereSql, params } = buildLanternWhere(req.query)

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
    // displayable_reasons explains a 不可展示 badge (Phase 1.5) — computed against the
    // current thresholds so the reason always matches what 管理 Admin shows.
    const thresholds = await getDisplayThresholds()
    return res.status(200).json(rows.map((l) => ({
      ...l,
      displayable_reasons: l.displayable ? [] : evaluateDisplayability(l, thresholds).reasons,
    })))
  }

  if (req.method === 'POST') {
    const role = await requireInventoryRole(req, res, 'editor')
    if (!role) return

    const {
      name_zh, name_en, category_id, qty, voltage, power_w,
      height_ft, width_ft, depth_ft, location_id,
      condition, cloth_damage_pct, frame_damage_pct, notes,
    } = req.body

    const nameZh = String(name_zh ?? '').trim()
    const nameEn = String(name_en ?? '').trim() || null
    if (!nameZh) return res.status(400).json({ error: '請填寫中文名稱 Name (ZH) is required' })
    if (!CONDITION_OPTIONS.includes(condition)) {
      return res.status(400).json({ error: '請選擇狀況 Condition is required' })
    }

    const cloth = cloth_damage_pct ?? 0
    const frame = frame_damage_pct ?? 0
    const { displayable } = evaluateDisplayability(
      { cloth_damage_pct: cloth, frame_damage_pct: frame },
      await getDisplayThresholds()
    )
    const email = req.inventoryEmail

    const { rows: [data] } = await query(
      `INSERT INTO inv_lantern_lanterns
         (name_zh, name_en, category_id, qty, voltage, power_w, height_ft, width_ft, depth_ft,
          location_id, condition, cloth_damage_pct, frame_damage_pct, displayable, notes,
          created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16)
       RETURNING *`,
      [
        nameZh, nameEn, category_id || null, qty || 1, voltage || null, power_w || null,
        height_ft || null, width_ft || null, depth_ft || null,
        location_id || null, condition, cloth, frame, displayable, notes || null,
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
    await logLanternChange({ before: null, after: data, event_type: 'created', actor: email, always: true })

    return res.status(201).json(data)
  }

  res.setHeader('Allow', ['GET', 'POST'])
  res.status(405).end()
}
