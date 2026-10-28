import { Pool, types } from 'pg'

// Return DATE columns (OID 1082) as plain 'YYYY-MM-DD' strings instead of JS Dates at
// server-local midnight. The Date form serialized to a full ISO timestamp, which broke
// every `due_date + 'T00:00:00'` on the client ("Invalid Date") and the edit form's
// <input type="date">. See lib/dates.js for comparing/formatting these values.
types.setTypeParser(1082, (v) => v)

// Module-level singleton — reused across requests in the same function instance.
// In Next.js dev, hot-reload creates fresh module scopes; globalThis prevents
// spawning a new pool on every reload and exhausting Neon's connection limit.
const g = globalThis
if (!g.__pgPool) {
  g.__pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  })
}

const pool = g.__pgPool

export const query = (text, params) => pool.query(text, params)
export default pool

export async function insertLog(entry) {
  await query(
    `INSERT INTO activity_log
       (event_id, user_id, entity_type, entity_id, entity_name, action, field_changed, old_value, new_value, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      entry.event_id      ?? null,
      entry.user_id       ?? null,
      entry.entity_type   ?? null,
      entry.entity_id     ?? null,
      entry.entity_name   ?? null,
      entry.action        ?? null,
      entry.field_changed ?? null,
      entry.old_value     ?? null,
      entry.new_value     ?? null,
      entry.note          ?? null,
    ]
  )
}

// Inventory Control's own activity log (inv_lantern_activity_log) — separate from the
// event-scoped activity_log above, keyed by user_email rather than user_id.
export async function insertInventoryLog(entry) {
  await query(
    `INSERT INTO inv_lantern_activity_log
       (table_name, record_id, record_name, action, field_changed, old_value, new_value, user_email)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      entry.table_name    ?? null,
      entry.record_id     ?? null,
      entry.record_name   ?? null,
      entry.action        ?? null,
      entry.field_changed ?? null,
      entry.old_value     ?? null,
      entry.new_value     ?? null,
      entry.user_email    ?? null,
    ]
  )
}
