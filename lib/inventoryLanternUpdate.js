// Pure, client-safe: turn "existing lantern row + edited fields" into the validated row
// to save. Shared by the single-lantern PUT (/api/inventory/lanterns/[tagId]) and the
// table view's batch save (/api/inventory/lanterns/batch), so both apply the same rules.
import {
  STATUS_OPTIONS, DISPLAY_DECISION_OPTIONS, CONDITION_OPTIONS, VOLTAGE_OPTIONS,
  normalizeRepairEase, normalizeBaseType, normalizeSizeClass,
} from './inventoryConstants.js'
import { evaluateDisplayability } from './inventoryEligibility.js'

// Nullable columns where an explicit '' / null in the body means "clear it". Before
// Phase 1 the PUT used `body.x ?? existing.x`, so choosing "—" (e.g. no location) in the
// edit form was silently ignored. A field absent from the body still keeps its value.
export const NULLABLE_FIELDS = [
  'name_en', 'category_id', 'voltage', 'power_w', 'height_ft', 'width_ft', 'depth_ft',
  'location_id', 'notes', 'display_decision', 'repair_ease', 'base_type', 'size_class',
]

// Every column a lantern edit may change.
export const EDITABLE_FIELDS = [
  'name_zh', 'name_en', 'category_id', 'qty', 'voltage', 'power_w',
  'height_ft', 'width_ft', 'depth_ft', 'location_id', 'condition',
  'cloth_damage_pct', 'frame_damage_pct', 'repair_ease', 'base_type', 'size_class',
  'notes', 'status', 'display_decision', 'label_attached',
]

// Decimal columns: [field, max] — max from the DECIMAL(p,2) column size.
const DECIMAL_FIELDS = [['power_w', 9999.99], ['height_ft', 999.99], ['width_ft', 999.99], ['depth_ft', 999.99]]

function isBlank(v) {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '')
}

// Returns { next, displayable } on success or { error } (a bilingual message).
export function buildLanternUpdate(existing, body = {}, thresholds) {
  const has = (f) => Object.prototype.hasOwnProperty.call(body, f)
  const pick = (f) => {
    if (!has(f)) return existing[f]
    if (NULLABLE_FIELDS.includes(f)) return isBlank(body[f]) ? null : body[f]
    return body[f] ?? existing[f]
  }

  const next = Object.fromEntries(EDITABLE_FIELDS.map((f) => [f, pick(f)]))

  next.name_zh = String(next.name_zh ?? '').trim()
  next.name_en = next.name_en == null ? null : (String(next.name_en).trim() || null)
  if (next.notes != null) next.notes = String(next.notes).trim() || null
  if (!next.name_zh) return { error: '請填寫中文名稱 Name (ZH) is required' }
  if (!STATUS_OPTIONS.includes(next.status)) return { error: '狀態無效 Invalid status' }
  if (!CONDITION_OPTIONS.includes(next.condition)) return { error: '狀況無效 Invalid condition' }
  if (next.display_decision !== null && !DISPLAY_DECISION_OPTIONS.includes(next.display_decision)) {
    return { error: '展示決定無效 Invalid display decision' }
  }
  if (next.voltage !== null && next.voltage !== existing.voltage && !VOLTAGE_OPTIONS.includes(next.voltage)) {
    return { error: '電壓無效 Invalid voltage' }
  }

  const qty = Number(next.qty)
  if (!Number.isInteger(qty) || qty < 1 || qty > 9999) return { error: '數量須為 1 以上的整數 QTY must be a whole number ≥ 1' }
  next.qty = qty

  for (const f of ['cloth_damage_pct', 'frame_damage_pct']) {
    const n = isBlank(next[f]) ? 0 : Number(next[f])
    if (!Number.isInteger(n) || n < 0 || n > 100) return { error: '損壞 % 須為 0–100 的整數 Damage % must be 0–100' }
    next[f] = n
  }

  for (const [f, max] of DECIMAL_FIELDS) {
    if (next[f] === null) continue
    const n = Number(next[f])
    if (!Number.isFinite(n) || n < 0 || n > max) return { error: `${f} 須為 0–${max} 的數字 must be a number 0–${max}` }
    next[f] = n
  }

  if (typeof next.label_attached !== 'boolean') next.label_attached = next.label_attached === 'true'

  next.repair_ease = normalizeRepairEase(next.repair_ease)
  if (next.repair_ease === undefined) return { error: '維修容易程度須為 0–5 Repair ease must be 0–5' }
  next.base_type = normalizeBaseType(next.base_type)
  if (next.base_type === undefined) return { error: '底座選項無效 Invalid base type' }
  next.size_class = normalizeSizeClass(next.size_class)
  if (next.size_class === undefined) return { error: '尺寸大小選項無效 Invalid size' }

  const { displayable } = evaluateDisplayability(next, thresholds)
  // Only block a *new* Selected on a non-displayable lantern; a lantern that was already
  // Selected (e.g. before an admin tightened the thresholds) can still be edited.
  if (next.display_decision === 'Selected' && !displayable && existing.display_decision !== 'Selected') {
    return { error: '不可展示的燈籠不能設為 Selected Cannot select a non-displayable lantern' }
  }

  return { next, displayable }
}
