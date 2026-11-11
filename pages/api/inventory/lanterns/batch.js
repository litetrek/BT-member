// POST /api/inventory/lanterns/batch — admin only. Saves the edits made in the lantern
// list's 表格 Table view in one go.
//
// Body: { updates: [{ tag_id, updated_at, changes: { field: value, ... } }, ...] }
//   updated_at is the row's updated_at as the table loaded it; if someone else saved
//   that lantern since, the row is reported as a conflict instead of overwriting them.
//
// Every row is checked first. If any row is invalid or conflicts, nothing is saved and
// the response is 400 { errors: [{ tag_id, error }] }. Otherwise each row is saved
// (same rules, activity log and event diff as the single-lantern edit) and the response
// is 200 { saved: [row, ...], errors: [...] } — errors only if a save failed mid-way.
import { query } from '@/lib/db'
import { requireInventoryRole } from '@/lib/auth'
import { getDisplayThresholds } from '@/lib/inventorySettings'
import { buildLanternUpdate, EDITABLE_FIELDS } from '@/lib/inventoryLanternUpdate'
import { saveLanternUpdate } from '@/lib/inventoryLanternSave'
import { missingColumnError } from '@/lib/inventorySchema'
import { fillMissingLanternName } from '@/lib/inventoryTranslate'

const MAX_ROWS = 500

function sameInstant(a, b) {
  if (!a || !b) return false
  return new Date(a).getTime() === new Date(b).getTime()
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).end()
  }
  const role = await requireInventoryRole(req, res, 'admin')
  if (!role) return

  const updates = req.body?.updates
  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({ error: '沒有要儲存的修改 No changes to save' })
  }
  if (updates.length > MAX_ROWS) {
    return res.status(400).json({ error: `一次最多 ${MAX_ROWS} 筆 At most ${MAX_ROWS} rows per save` })
  }

  const tagIds = updates.map((u) => String(u?.tag_id ?? ''))
  if (new Set(tagIds).size !== tagIds.length) return res.status(400).json({ error: '重複的編號 Duplicate tag_id' })

  const { rows: existingRows } = await query('SELECT * FROM inv_lantern_lanterns WHERE tag_id = ANY($1::text[])', [tagIds])
  const byTag = new Map(existingRows.map((r) => [r.tag_id, r]))
  const thresholds = await getDisplayThresholds()

  const errors = []
  const planned = []
  for (const u of updates) {
    const tag_id = String(u?.tag_id ?? '')
    const existing = byTag.get(tag_id)
    if (!existing) { errors.push({ tag_id, error: '找不到這盞燈籠 Lantern not found' }); continue }
    if (!sameInstant(existing.updated_at, u.updated_at)) {
      errors.push({ tag_id, error: `已被 ${existing.updated_by ?? '其他人'} 修改，請重新載入 Changed by someone else — reload first` })
      continue
    }
    // Only the editable columns; anything else in `changes` is ignored.
    const changes = Object.fromEntries(
      Object.entries(u.changes ?? {}).filter(([k]) => EDITABLE_FIELDS.includes(k))
    )
    const result = buildLanternUpdate(existing, changes, thresholds)
    if (result.error) { errors.push({ tag_id, error: result.error }); continue }
    const columnError = await missingColumnError(result.next)
    if (columnError) { errors.push({ tag_id, error: columnError }); continue }
    planned.push({ existing, ...result })
  }
  if (errors.length) return res.status(400).json({ errors })

  // Rows whose edit left only one name: AI fills in the other (in parallel; usually few).
  await Promise.all(planned.map((p) => fillMissingLanternName(p.next, p.nameMissing)))

  const saved = []
  const failed = []
  for (const p of planned) {
    try {
      saved.push(await saveLanternUpdate({ ...p, email: req.inventoryEmail }))
    } catch (err) {
      console.error('[lanterns/batch] save failed:', p.existing.tag_id, err.message)
      failed.push({ tag_id: p.existing.tag_id, error: '儲存失敗 Save failed' })
    }
  }
  return res.status(failed.length ? 207 : 200).json({ saved, errors: failed })
}
