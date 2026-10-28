// Lantern Inventory — Phase 1 migration (idempotent; safe to re-run).
//   1. inv_lantern_events   — per-lantern event log (before/after diffs), foundation for
//                             the Phase 4 timeline. Written by every create / edit /
//                             Quick Inspect / photo change from now on.
//   2. inv_lantern_settings — key/value settings, seeded with the current display
//                             thresholds (previously hard-coded NOT_DISPLAYABLE_DAMAGE_PCT = 30).
// No RLS: like every other inv_lantern_* table, these are only reached through API
// routes gated by requireInventoryRole() (lib/auth.js), never from the browser.
// Matching models live in prisma/schema.prisma so a later `prisma db push` keeps them.
// Usage: node scripts/migrate-phase1-lantern-events-settings.js

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
  ['inv_lantern_events table', `
    CREATE TABLE IF NOT EXISTS inv_lantern_events (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      lantern_id  uuid NOT NULL,
      event_type  text NOT NULL,
      actor       text,
      changes     jsonb NOT NULL DEFAULT '{}'::jsonb,
      session_id  uuid,
      note        text,
      created_at  timestamptz(6) NOT NULL DEFAULT now()
    )`],
  ['inv_lantern_events event_type check', `
    DO $$ BEGIN
      ALTER TABLE inv_lantern_events ADD CONSTRAINT inv_lantern_events_type_check
        CHECK (event_type IN ('created','updated','inspected','moved','status_changed','photo_added','photo_deleted'));
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`],
  ['inv_lantern_events index', `
    CREATE INDEX IF NOT EXISTS inv_lantern_events_lantern_id_created_at_idx
      ON inv_lantern_events (lantern_id, created_at)`],
  ['inv_lantern_settings table', `
    CREATE TABLE IF NOT EXISTS inv_lantern_settings (
      key         text PRIMARY KEY,
      value       jsonb NOT NULL,
      updated_at  timestamptz(6) NOT NULL DEFAULT now(),
      updated_by  text
    )`],
  // Seed with the values that were hard-coded before Phase 1 — no lantern changes
  // displayability by running this. DO NOTHING keeps any value an admin already set.
  ['seed display thresholds', `
    INSERT INTO inv_lantern_settings (key, value, updated_by) VALUES
      ('display_threshold_cloth_pct', '30'::jsonb, 'migration'),
      ('display_threshold_frame_pct', '30'::jsonb, 'migration')
    ON CONFLICT (key) DO NOTHING`],
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
  if (!process.exitCode) console.log('\nPhase 1 migration complete.')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
