// Migrates the old hardcoded INVENTORY_ACCESS map (lib/inventory.js, pre-admin-screen)
// into the new inventory_module_access table. One-time, idempotent (ON CONFLICT DO
// NOTHING on the email+module_key unique constraint), safe to re-run.
// Usage: node scripts/seed-inventory-module-access.js

const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local')
  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  const env = {}
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    env[key] = val
  }
  return env
}

const ENTRIES = [
  { email: 'vlin77@gmail.com', module_key: 'lanterns', role: 'admin' },
  { email: 'joannazhao168@gmail.com', module_key: 'lanterns', role: 'editor' },
  { email: 'weiyanoble@gmail.com', module_key: 'lanterns', role: 'editor' },
  { email: 'qqandcici@gmail.com', module_key: 'lanterns', role: 'editor' },
  { email: 'pai8788@gmail.com', module_key: 'lanterns', role: 'editor' },
]

async function run() {
  const env = loadEnv()
  if (!env.DATABASE_URL) {
    console.error('No DATABASE_URL found in .env.local')
    process.exit(1)
  }

  const client = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()
  console.log('Connected to database.\n')

  try {
    for (const e of ENTRIES) {
      await client.query(
        `INSERT INTO inventory_module_access (email, module_key, role, created_by, updated_by)
         VALUES ($1, $2, $3, 'migration', 'migration')
         ON CONFLICT (email, module_key) DO NOTHING`,
        [e.email, e.module_key, e.role]
      )
    }
    console.log(`OK  ${ENTRIES.length} entries seeded (or already present)`)
  } catch (err) {
    console.error('ERROR', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }

  console.log('\nSeed complete.')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
