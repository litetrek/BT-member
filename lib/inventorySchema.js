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

// Optional lantern columns and the migration that adds them. A save that sets one of
// these while its column is missing would be dropped silently, so the lantern PUT and
// the table's batch save refuse it with this message instead.
const OPTIONAL_LANTERN_COLUMNS = [
  ['repair_ease', '維修容易程度', hasRepairEaseColumn],
  ['base_type', '底座', hasBaseTypeColumn],
  ['size_class', '尺寸大小', hasSizeClassColumn],
]

// Returns an error message if `next` sets a value for a column the database doesn't
// have yet, otherwise null.
export async function missingColumnError(next) {
  const missing = []
  for (const [field, label, check] of OPTIONAL_LANTERN_COLUMNS) {
    if (next[field] !== null && next[field] !== undefined && !(await check())) missing.push(label)
  }
  if (!missing.length) return null
  return `資料庫還沒有「${missing.join('、')}」欄位，無法儲存。請管理員先執行資料庫更新 node scripts/migrate-lantern-fields.js（Database needs the lantern-fields migration）`
}
