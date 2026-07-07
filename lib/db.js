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
