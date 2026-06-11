// Run this once to deploy schema to Supabase
// Usage: node scripts/run-schema.js

const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

// Parse .env.local manually (no dotenv dep)
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

async function main() {
  const env = loadEnv()
  const connStr = env.DIRECT_URL

  if (!connStr) {
    console.error('DIRECT_URL not found in .env.local')
    process.exit(1)
  }

  // Encode @ in password portion of the URL
  // Format: postgresql://user:password@host:port/db
  const fixed = connStr.replace(
    /^(postgresql:\/\/[^:]+:)(.+?)(@[^@]+:\d+\/.+)$/,
    (_, prefix, pass, suffix) => prefix + encodeURIComponent(pass) + suffix
  )

  const client = new Client({ connectionString: fixed, ssl: { rejectUnauthorized: false } })

  try {
    await client.connect()
    console.log('Connected to Supabase.')

    const schema = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'schema.sql'), 'utf8')
    await client.query(schema)
    console.log('Schema created successfully.')

    const seed = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'seed.sql'), 'utf8')
    await client.query(seed)
    console.log('Seed data inserted.')
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
