// Server-only: detect optional columns added by later migrations, so code can deploy
// before the migration has been run on Neon without breaking saves.
import { query } from '@/lib/db'

let repairEase = { value: null, at: 0 }

// True once scripts/migrate-repair-ease.js has added repair_ease to both
// inv_lantern_lanterns and inv_lantern_inspections. A "yes" is cached for the life of
// the server; a "no" is re-checked after a minute, so running the migration takes
// effect without a redeploy.
export async function hasRepairEaseColumn() {
  if (repairEase.value === true) return true
  if (repairEase.value === false && Date.now() - repairEase.at < 60_000) return false
  try {
    const { rows } = await query(
      `SELECT count(*)::int AS n FROM information_schema.columns
       WHERE column_name = 'repair_ease'
         AND table_name IN ('inv_lantern_lanterns', 'inv_lantern_inspections')`
    )
    repairEase = { value: rows[0].n === 2, at: Date.now() }
  } catch {
    repairEase = { value: false, at: Date.now() }
  }
  return repairEase.value
}
