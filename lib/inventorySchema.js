// Server-only: detect optional columns added by later migrations, so code can deploy
// before the migration has been run on Neon without breaking saves.
// Columns come from scripts/migrate-lantern-fields.js.
import { query } from '@/lib/db'

const cache = new Map() // key -> { value, at }

// A "yes" is cached for the life of the server; a "no" is re-checked after a minute,
// so running the migration takes effect without a redeploy.
async function columnsExist(key, pairs) {
  const hit = cache.get(key)
  if (hit?.value === true) return true
  if (hit?.value === false && Date.now() - hit.at < 60_000) return false
  let value = false
  try {
    const { rows } = await query(
      `SELECT count(*)::int AS n FROM information_schema.columns
       WHERE (table_name, column_name) IN (SELECT * FROM unnest($1::text[], $2::text[]))`,
      [pairs.map((p) => p[0]), pairs.map((p) => p[1])]
    )
    value = rows[0].n === pairs.length
  } catch {
    value = false
  }
  cache.set(key, { value, at: Date.now() })
  return value
}

// 維修容易程度 — on both the lantern and the inspection tables.
export function hasRepairEaseColumn() {
  return columnsExist('repair_ease', [
    ['inv_lantern_lanterns', 'repair_ease'],
    ['inv_lantern_inspections', 'repair_ease'],
  ])
}

// 尺寸大小 Size — lantern table only.
export function hasSizeClassColumn() {
  return columnsExist('size_class', [['inv_lantern_lanterns', 'size_class']])
}

// 底座 Base — lantern table only.
export function hasBaseTypeColumn() {
  return columnsExist('base_type', [['inv_lantern_lanterns', 'base_type']])
}
