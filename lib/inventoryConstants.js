// Shared constants for the Lantern Inventory module. Client-safe (no server-only imports).

export const VOLTAGE_OPTIONS = ['AC110V', 'DC24V']
export const CONDITION_OPTIONS = ['Good', 'OK', 'Fair', 'Bad']
export const STATUS_OPTIONS = ['Active', 'Retired', 'Missing']
export const DISPLAY_DECISION_OPTIONS = ['Candidate', 'Selected', 'Needs repair', 'Not this year']

// 維修容易程度 Repair ease — 0–5 slider under the damage sliders. Higher = more repair work.
// NULL in the database = 未評估 (not rated yet).
export const REPAIR_EASE_LEVELS = [
  { value: 0, zh: '不需修補', en: 'No repair needed' },
  { value: 1, zh: '稍微修補', en: 'Quick touch-up' },
  { value: 2, zh: '小修', en: 'Minor repair' },
  { value: 3, zh: '中度修補', en: 'Moderate repair' },
  { value: 4, zh: '大修', en: 'Major repair' },
  { value: 5, zh: '需大幅修補', en: 'Extensive rebuild' },
]

// '' / null / undefined → null (未評估); otherwise an integer 0–5, or undefined if invalid.
export function normalizeRepairEase(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isInteger(n) && n >= 0 && n <= 5 ? n : undefined
}

export function formatRepairEase(v) {
  const level = REPAIR_EASE_LEVELS.find((l) => l.value === normalizeRepairEase(v))
  return level ? `${level.value} · ${level.zh}` : '未評估'
}

// Display eligibility now lives in lib/inventoryEligibility.js (evaluateDisplayability)
// with thresholds from inv_lantern_settings, editable in 管理 Admin (Phase 1).

// Pseudo-location code for lanterns with no location_id. Used as a URL segment
// (/inventory/lanterns/locations/unassigned) and as the list filter value
// location_id=none. Real locations may not use this code (enforced on create).
export const UNASSIGNED_LOCATION_CODE = 'unassigned'
export const UNASSIGNED_FILTER_VALUE = 'none'
export const UNASSIGNED_LABEL = '未指定地點 Unassigned'

// 「燈籠庫存新功能說明」page — plain HTML in public/lantern-guide/index.html, served by
// this site (short URL /lantern-guide via next.config.js rewrite). Linked from the
// 燈籠庫存 main screen. Edit the HTML file and push to update it.
export const LANTERN_WHATS_NEW_URL = '/lantern-guide'

// "8 筆 · 29 盞" — records (lantern groups) · units (sum of QTY). Phase 1.1: location
// cards used to label the record count as 盞.
export function formatLocationCounts(records, qty) {
  return `${records ?? 0} 筆 · ${qty ?? 0} 盞`
}

// Records/units for a list of lantern rows (e.g. the Unassigned pseudo-location).
export function summarizeLanterns(lanterns) {
  const list = lanterns ?? []
  return { records: list.length, qty: list.reduce((sum, l) => sum + (Number(l.qty) || 0), 0) }
}
