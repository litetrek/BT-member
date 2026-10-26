// Inventory Control / Lantern Inventory — Stage 0 pre-setup.
// Creates the tag-ID sequence that prisma/schema.prisma's InventoryLantern.tag_id
// default references (`nextval('inv_lantern_tag_seq')`). Must run BEFORE
// `npx prisma db push`, since db push does not create bare sequences.
// Usage: node scripts/migrate-inventory-lanterns-presetup.js

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

async function run() {
  const env = loadEnv()
  const connectionString = env.DATABASE_URL
  if (!connectionString) {
    console.error('No DATABASE_URL found in .env.local')
    process.exit(1)
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })
  await client.connect()
  console.log('Connected to database.\n')

  try {
    await client.query(`CREATE SEQUENCE IF NOT EXISTS inv_lantern_tag_seq START 1;`)
    console.log('OK  inv_lantern_tag_seq ready')
  } catch (err) {
    console.error('ERROR', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }

  console.log('\nPre-setup complete. Now run: npx prisma db push')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
