import { Pool } from 'pg'

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
