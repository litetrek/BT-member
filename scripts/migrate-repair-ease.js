// Lantern Inventory — 維修容易程度 Repair ease (idempotent; safe to re-run).
// Adds repair_ease (0–5, NULL = 未評估 not rated yet) to the lantern table and to the
// inspection history, so each Quick Inspect records the rating it was saved with.
//   0 = 不需修補 … 5 = 需大幅修補 (higher = more repair work). Labels live in
//   lib/inventoryConstants.js REPAIR_EASE_LEVELS.
// Matching fields are in prisma/schema.prisma so a later `prisma db push` keeps them.
// Usage: node scripts/migrate-repair-ease.js

const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local')
  const env = {}
  if (!fs.existsSync(envPath)) return env
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
  }
  return env
}

const STEPS = [
  ['inv_lantern_lanterns.repair_ease', `ALTER TABLE inv_lantern_lanterns ADD COLUMN IF NOT EXISTS repair_ease smallint`],
  ['inv_lantern_lanterns repair_ease 0–5 check', `
    DO $$ BEGIN
      ALTER TABLE inv_lantern_lanterns ADD CONSTRAINT inv_lantern_lanterns_repair_ease_check
        CHECK (repair_ease IS NULL OR repair_ease BETWEEN 0 AND 5);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`],
  ['inv_lantern_inspections.repair_ease', `ALTER TABLE inv_lantern_inspections ADD COLUMN IF NOT EXISTS repair_ease smallint`],
  ['inv_lantern_inspections repair_ease 0–5 check', `
    DO $$ BEGIN
      ALTER TABLE inv_lantern_inspections ADD CONSTRAINT inv_lantern_inspections_repair_ease_check
        CHECK (repair_ease IS NULL OR repair_ease BETWEEN 0 AND 5);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`],
]

async function run() {
  const connectionString = process.env.DATABASE_URL || loadEnv().DATABASE_URL
  if (!connectionString) {
    console.error('No DATABASE_URL found (env or .env.local)')
    process.exit(1)
  }
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })
  await client.connect()
  console.log('Connected to database.\n')
  try {
    for (const [label, sql] of STEPS) {
      await client.query(sql)
      console.log(`OK  ${label}`)
    }
  } catch (err) {
    console.error('ERROR', err.message)
    process.exitCode = 1
  } finally {
    await client.end()
  }
  if (!process.exitCode) console.log('\nRepair-ease migration complete.')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
