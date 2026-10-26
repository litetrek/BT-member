// Inventory Control / Lantern Inventory — Stage 0 seed data.
// Seeds categories and all storage locations. Idempotent (ON CONFLICT DO NOTHING on
// the unique code/name), safe to re-run.
// Usage: node scripts/seed-inventory-lanterns.js

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

const CATEGORIES = [
  { name_zh: '海洋', name_en: 'Ocean', sort_order: 0 },
  { name_zh: '天界', name_en: 'Heaven', sort_order: 1 },
  { name_zh: '森林', name_en: 'Forest', sort_order: 2 },
  { name_zh: '蓮花園', name_en: 'Lotus Garden', sort_order: 3 },
]

function buildLocations() {
  const locations = []
  let sort = 0
  for (const [zone, count] of [['A', 10], ['B', 10], ['C', 10], ['D', 6]]) {
    for (let i = 1; i <= count; i++) {
      locations.push({ code: `${zone}${i}`, zone, sort_order: sort++ })
    }
  }
  locations.push({ code: 'Cabin', zone: 'Cabin', sort_order: sort++ })
  for (let i = 1; i <= 3; i++) {
    locations.push({ code: `E${i}`, zone: 'E', sort_order: sort++ })
  }
  return locations
}

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
    for (const c of CATEGORIES) {
      await client.query(
        `INSERT INTO inv_lantern_categories (name_zh, name_en, sort_order)
         SELECT $1, $2, $3
         WHERE NOT EXISTS (SELECT 1 FROM inv_lantern_categories WHERE name_en = $2)`,
        [c.name_zh, c.name_en, c.sort_order]
      )
    }
    console.log(`OK  ${CATEGORIES.length} categories seeded (or already present)`)

    const locations = buildLocations()
    for (const l of locations) {
      await client.query(
        `INSERT INTO inv_lantern_locations (code, zone, sort_order)
         VALUES ($1, $2, $3)
         ON CONFLICT (code) DO NOTHING`,
        [l.code, l.zone, l.sort_order]
      )
    }
    console.log(`OK  ${locations.length} locations seeded (or already present)`)
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
