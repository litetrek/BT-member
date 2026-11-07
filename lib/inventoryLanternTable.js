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

// Column order follows the edit form. `bulk` = offered in 批次設定 Set for all.
export function buildTableColumns({ categories = [], locations = [] } = {}) {
  return [
    { key: 'tag_id', label: '編號 Tag', readonly: true },
    { key: 'name_zh', label: '中文名稱', type: 'text', width: 'min-w-[10rem]' },
    { key: 'name_en', label: 'English name', type: 'text', width: 'min-w-[11rem]' },
    { key: 'category_id', label: '類別', type: 'select', bulk: true, width: 'min-w-[7rem]',
      options: withBlank('—', categories.map((c) => ({ value: String(c.id), label: c.name_zh }))) },
    { key: 'location_id', label: '地點', type: 'select', bulk: true, width: 'min-w-[6rem]',
      options: withBlank('未指定', locations.map((l) => ({ value: String(l.id), label: l.code }))) },
    { key: 'qty', label: 'QTY', type: 'number', min: 1, step: 1, bulk: true, width: 'w-20' },
    { key: 'condition', label: '狀況', type: 'select', bulk: true, options: plain(CONDITION_OPTIONS) },
    { key: 'cloth_damage_pct', label: '布面損壞 %', type: 'number', min: 0, max: 100, step: 5, bulk: true, width: 'w-24' },
    { key: 'frame_damage_pct', label: '骨架損壞 %', type: 'number', min: 0, max: 100, step: 5, bulk: true, width: 'w-24' },
    { key: 'repair_ease', label: '維修容易程度', type: 'select', bulk: true,
      options: withBlank('未評估', REPAIR_EASE_LEVELS.map((l) => ({ value: String(l.value), label: `${l.value} · ${l.zh}` }))) },
    { key: 'status', label: '狀態', type: 'select', bulk: true, options: plain(STATUS_OPTIONS) },
    { key: 'display_decision', label: '展示決定', type: 'select', bulk: true, options: withBlank('—', plain(DISPLAY_DECISION_OPTIONS)) },
    { key: 'voltage', label: '電壓', type: 'select', bulk: true, options: withBlank('—', plain(VOLTAGE_OPTIONS)) },
    { key: 'power_w', label: '瓦數 W', type: 'number', min: 0, step: 'any', width: 'w-20' },
    { key: 'height_ft', label: '高 ft', type: 'number', min: 0, step: 'any', width: 'w-20' },
    { key: 'width_ft', label: '寬 ft', type: 'number', min: 0, step: 'any', width: 'w-20' },
    { key: 'depth_ft', label: '深 ft', type: 'number', min: 0, step: 'any', width: 'w-20' },
    { key: 'size_class', label: '尺寸大小', type: 'select', bulk: true,
      options: withBlank('—', SIZE_CLASS_OPTIONS.map((o) => ({ value: o.value, label: `${o.zh} ${o.en}` }))) },
    { key: 'base_type', label: '底座', type: 'select', bulk: true,
      options: withBlank('—', BASE_TYPE_OPTIONS.map((o) => ({ value: o.value, label: `${o.zh} ${o.en}` }))) },
    { key: 'label_attached', label: '已貼標籤', type: 'checkbox', bulk: true },
    { key: 'notes', label: '備註 Notes', type: 'text', width: 'min-w-[14rem]' },
  ]
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
