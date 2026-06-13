// Day 6 migration: add lang column to users table
// Usage: node scripts/migrate-day6.js

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

const DDL = [
  {
    name: '1. Add lang column to users (default zh)',
    sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS lang text NOT NULL DEFAULT 'zh';`,
  },
]

async function run() {
  const env = loadEnv()
  const connectionString = env.DATABASE_URL || env.POSTGRES_URL || env.SUPABASE_DB_URL
  if (!connectionString) {
    console.error('No DATABASE_URL / POSTGRES_URL / SUPABASE_DB_URL found in .env.local')
    process.exit(1)
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })
  await client.connect()
  console.log('Connected to database.\n')

  for (const step of DDL) {
    process.stdout.write(`${step.name} ... `)
    try {
      await client.query(step.sql)
      console.log('OK')
    } catch (err) {
      console.log('ERROR')
      console.error(err.message)
      await client.end()
      process.exit(1)
    }
  }

  await client.end()
  console.log('\nDay 6 migration complete.')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
