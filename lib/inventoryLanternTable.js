// Pure, client-safe helpers for the lantern list's 表格 Table view
// (components/InventoryLanternTable.jsx): column definitions, turning stored values into
// cell text, deciding whether a cell really changed, and building the save payload.
import {
  CONDITION_OPTIONS, STATUS_OPTIONS, DISPLAY_DECISION_OPTIONS, VOLTAGE_OPTIONS,
  BASE_TYPE_OPTIONS, SIZE_CLASS_OPTIONS, REPAIR_EASE_LEVELS,
} from './inventoryConstants.js'

const NUMERIC_FIELDS = ['qty', 'cloth_damage_pct', 'frame_damage_pct', 'power_w', 'height_ft', 'width_ft', 'depth_ft']
const BOOLEAN_FIELDS = ['label_attached']

const plain = (values) => values.map((v) => ({ value: v, label: v }))
const withBlank = (label, opts) => [{ value: '', label }, ...opts]

// Column order follows the edit form. Every column except 編號 can be set from the 批次 row.
export function buildTableColumns({ categories = [], locations = [] } = {}) {
  return [
    { key: 'tag_id', label: '編號 Tag', readonly: true },
    { key: 'name_zh', label: '中文名稱', type: 'text', width: 'min-w-[10rem]' },
    { key: 'name_en', label: 'English name', type: 'text', width: 'min-w-[11rem]' },
    { key: 'category_id', label: '類別', type: 'select', width: 'min-w-[7rem]',
      options: withBlank('—', categories.map((c) => ({ value: String(c.id), label: c.name_zh }))) },
    { key: 'location_id', label: '地點', type: 'select', width: 'min-w-[6rem]',
      options: withBlank('未指定', locations.map((l) => ({ value: String(l.id), label: l.code }))) },
    { key: 'qty', label: 'QTY', type: 'number', min: 1, step: 1, width: 'w-20' },
    { key: 'condition', label: '狀況', type: 'select', options: plain(CONDITION_OPTIONS) },
    { key: 'cloth_damage_pct', label: '布面損壞 %', type: 'number', min: 0, max: 100, step: 5, width: 'w-24' },
    { key: 'frame_damage_pct', label: '骨架損壞 %', type: 'number', min: 0, max: 100, step: 5, width: 'w-24' },
    { key: 'repair_ease', label: '維修容易程度', type: 'select',
      options: withBlank('未評估', REPAIR_EASE_LEVELS.map((l) => ({ value: String(l.value), label: `${l.value} · ${l.zh}` }))) },
    { key: 'status', label: '狀態', type: 'select', options: plain(STATUS_OPTIONS) },
    { key: 'display_decision', label: '展示決定', type: 'select', options: withBlank('—', plain(DISPLAY_DECISION_OPTIONS)) },
    { key: 'voltage', label: '電壓', type: 'select', options: withBlank('—', plain(VOLTAGE_OPTIONS)) },
    { key: 'power_w', label: '瓦數 W', type: 'number', min: 0, step: 'any', width: 'w-20' },
    { key: 'height_ft', label: '高 ft', type: 'number', min: 0, step: 'any', width: 'w-20' },
    { key: 'width_ft', label: '寬 ft', type: 'number', min: 0, step: 'any', width: 'w-20' },
    { key: 'depth_ft', label: '深 ft', type: 'number', min: 0, step: 'any', width: 'w-20' },
    { key: 'size_class', label: '尺寸大小', type: 'select',
      options: withBlank('—', SIZE_CLASS_OPTIONS.map((o) => ({ value: o.value, label: `${o.zh} ${o.en}` }))) },
    { key: 'base_type', label: '底座', type: 'select',
      options: withBlank('—', BASE_TYPE_OPTIONS.map((o) => ({ value: o.value, label: `${o.zh} ${o.en}` }))) },
    { key: 'label_attached', label: '已貼標籤', type: 'checkbox' },
    { key: 'notes', label: '備註 Notes', type: 'text', width: 'min-w-[14rem]' },
  ]
}

// ── Column layout: each viewer can drag columns into another order and drag a header's
// right edge to change its width. Saved per browser. 編號 and 中文名稱 stay first (they are
// the frozen columns) and can be resized but not moved.
export const PINNED_COLUMNS = ['tag_id', 'name_zh']
export const MIN_COLUMN_WIDTH = 48
const LAYOUT_KEY = 'inv_lantern_table_layout'

// Columns in the saved order. Keys no longer in the table are dropped; columns added
// since the order was saved go back after the column they follow by default.
export function orderColumns(columns, order) {
  const pinned = columns.filter((c) => PINNED_COLUMNS.includes(c.key))
  const rest = columns.filter((c) => !PINNED_COLUMNS.includes(c.key))
  const byKey = new Map(rest.map((c) => [c.key, c]))
  const result = (order ?? []).filter((k) => byKey.has(k)).map((k) => byKey.get(k))
  const placed = new Set(result.map((c) => c.key))
  rest.forEach((c, i) => {
    if (placed.has(c.key)) return
    const prev = rest.slice(0, i).reverse().find((p) => placed.has(p.key))
    result.splice(prev ? result.indexOf(prev) + 1 : 0, 0, c)
    placed.add(c.key)
  })
  return [...pinned, ...result]
}

// Move column `key` next to `targetKey` (before it, or after it when `after`). Returns the
// new order of the movable columns.
export function moveColumn(orderedKeys, key, targetKey, after = false) {
  const keys = orderedKeys.filter((k) => !PINNED_COLUMNS.includes(k))
  if (key === targetKey || !keys.includes(key) || PINNED_COLUMNS.includes(key)) return keys
  const without = keys.filter((k) => k !== key)
  if (PINNED_COLUMNS.includes(targetKey)) return [key, ...without]
  const at = without.indexOf(targetKey)
  if (at === -1) return keys
  without.splice(after ? at + 1 : at, 0, key)
  return without
}

export function loadTableLayout() {
  try {
    const v = JSON.parse(localStorage.getItem(LAYOUT_KEY) || 'null')
    const order = Array.isArray(v?.order) ? v.order.filter((k) => typeof k === 'string') : []
    const widths = {}
    for (const [k, w] of Object.entries(v?.widths ?? {})) {
      if (Number.isFinite(w) && w >= MIN_COLUMN_WIDTH) widths[k] = Math.round(w)
    }
    return { order, widths }
  } catch { return { order: [], widths: {} } }
}

export function saveTableLayout(layout) {
  try {
    if (!layout.order.length && !Object.keys(layout.widths).length) localStorage.removeItem(LAYOUT_KEY)
    else localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout))
  } catch {}
}

// Stored value → what the cell shows / the input holds. pg returns DECIMAL as "12.50";
// show "12.5" so an untouched cell never looks edited.
export function cellText(field, v) {
  if (BOOLEAN_FIELDS.includes(field)) return v === true || v === 'true'
  if (v === null || v === undefined) return ''
  if (NUMERIC_FIELDS.includes(field)) {
    const n = Number(v)
    return Number.isFinite(n) && String(v).trim() !== '' ? String(n) : String(v)
  }
  return String(v)
}

function normInput(field, v) {
  if (BOOLEAN_FIELDS.includes(field)) return v === true || v === 'true'
  const s = v === null || v === undefined ? '' : String(v).trim()
  if (NUMERIC_FIELDS.includes(field) && s !== '' && Number.isFinite(Number(s))) return String(Number(s))
  return s
}

// Is the edited input the same as the stored value? ("12.50" vs "12.5", "  x " vs "x")
export function cellsEqual(field, stored, input) {
  return normInput(field, cellText(field, stored)) === normInput(field, input)
}

// Input value → what the batch API receives. Blank numbers go as '' so the server either
// clears a nullable column or rejects a required one (QTY) instead of guessing.
export function toPayloadValue(field, v) {
  if (BOOLEAN_FIELDS.includes(field)) return v === true || v === 'true'
  const s = v === null || v === undefined ? '' : String(v).trim()
  if (NUMERIC_FIELDS.includes(field)) return s === '' || !Number.isFinite(Number(s)) ? s : Number(s)
  return s
}

// Human-readable cell value: the option label for selects, ✓ for checkboxes.
export function optionLabel(col, value) {
  if (!col) return value === true ? '✓' : value === false ? '' : String(value ?? '')
  if (col.type === 'checkbox') return value === true || value === 'true' ? '✓ 是' : '否'
  if (col.type === 'select') {
    const o = col.options.find((x) => x.value === String(value ?? ''))
    if (o) return o.value === '' ? '' : o.label
  }
  return String(value ?? '')
}
