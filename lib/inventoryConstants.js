// Shared constants for the Lantern Inventory module. Client-safe (no server-only imports).

export const VOLTAGE_OPTIONS = ['AC110V', 'DC24V']
export const CONDITION_OPTIONS = ['Good', 'OK', 'Fair', 'Bad']
export const STATUS_OPTIONS = ['Active', 'Retired', 'Missing']
export const DISPLAY_DECISION_OPTIONS = ['Candidate', 'Selected', 'Needs repair', 'Not this year']

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
