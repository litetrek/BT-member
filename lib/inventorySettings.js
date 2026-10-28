// Server-only: Lantern Inventory settings (inv_lantern_settings key/value table).
import { query } from '@/lib/db'
import { DEFAULT_THRESHOLDS } from '@/lib/inventoryEligibility'

export const THRESHOLD_KEYS = {
  cloth_pct: 'display_threshold_cloth_pct',
  frame_pct: 'display_threshold_frame_pct',
}

// Falls back to the defaults if the table doesn't exist yet (migration not run) so the
// app keeps working with the old behaviour during a deploy.
export async function getDisplayThresholds() {
  try {
    const { rows } = await query(
      'SELECT key, value FROM inv_lantern_settings WHERE key = ANY($1)',
      [Object.values(THRESHOLD_KEYS)]
    )
    const byKey = Object.fromEntries(rows.map((r) => [r.key, Number(r.value)]))
    const out = { ...DEFAULT_THRESHOLDS }
    for (const [field, key] of Object.entries(THRESHOLD_KEYS)) {
      if (Number.isFinite(byKey[key])) out[field] = byKey[key]
    }
    return out
  } catch (err) {
    console.error('[inventorySettings] falling back to default thresholds:', err.message)
    return { ...DEFAULT_THRESHOLDS }
  }
}

export async function setDisplayThresholds(thresholds, email) {
  for (const [field, key] of Object.entries(THRESHOLD_KEYS)) {
    await query(
      `INSERT INTO inv_lantern_settings (key, value, updated_at, updated_by)
       VALUES ($1, $2::jsonb, now(), $3)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by`,
      [key, JSON.stringify(thresholds[field]), email]
    )
  }
}
