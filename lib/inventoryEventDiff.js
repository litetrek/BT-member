// Pure helpers for inv_lantern_events — kept dependency-free so they can be unit-tested
// with `node --test` and reused client-side by the Phase 4 timeline.

export const LANTERN_TRACKED_FIELDS = [
  'name_zh', 'name_en', 'category_id', 'qty', 'voltage', 'power_w',
  'height_ft', 'width_ft', 'depth_ft', 'location_id',
  'condition', 'cloth_damage_pct', 'frame_damage_pct', 'displayable',
  'status', 'display_decision', 'label_attached', 'notes',
]

// pg returns numeric columns as strings ("12.50") — normalise so "12.5" vs 12.5 isn't
// recorded as a change, and '' / undefined / null all mean "empty".
function norm(v) {
  if (v === undefined || v === '') return null
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)) && /^-?\d+(\.\d+)?$/.test(v.trim())) return Number(v)
  return v
}

// before = null for a create → every non-empty field becomes [null, value].
export function diffLanternFields(before, after, fields = LANTERN_TRACKED_FIELDS) {
  const changes = {}
  for (const f of fields) {
    const b = before ? norm(before[f]) : null
    const a = after ? norm(after[f]) : null
    if (b !== a) changes[f] = [b, a]
  }
  return changes
}

// An edit that only moved the lantern is 'moved'; only changed status is
// 'status_changed'; anything else (or a mix) is 'updated'. changes always holds the full diff.
export function pickEventType(changes) {
  const keys = Object.keys(changes ?? {})
  if (keys.length === 1 && keys[0] === 'location_id') return 'moved'
  if (keys.length === 1 && keys[0] === 'status') return 'status_changed'
  return 'updated'
}
