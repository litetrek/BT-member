// Applies the unified-import schema by hand (the import API also applies it on first use).
// Usage: node scripts/migrate-import.js
// Statements are kept in sync with lib/importSchema.js (IMPORT_DDL); all are IF NOT EXISTS.

const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

function loadEnv() {
  const env = {}
  const p = path.join(__dirname, '..', '.env.local')
  if (!fs.existsSync(p)) return env
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const s = line.trim()
    if (!s || s.startsWith('#') || !s.includes('=')) continue
    const i = s.indexOf('=')
    env[s.slice(0, i).trim()] = s.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
  return env
}

async function main() {
  // lib/importSchema.js is an ES module using the app's db helper; read its DDL as text.
  const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'importSchema.js'), 'utf8')
  const block = src.slice(src.indexOf('IMPORT_DDL = ['), src.indexOf('\n]\n'))
  const ddl = [...block.matchAll(/`([\s\S]*?)`/g)].map((m) => m[1])

  const env = { ...loadEnv(), ...process.env }
  const client = new Client({ connectionString: env.DIRECT_URL || env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()
  try {
    for (const sql of ddl) {
      await client.query(sql)
      console.log('ok  ', sql.split('\n')[0].trim().slice(0, 90))
    }
  } finally {
    await client.end()
  }
}

main().catch((e) => { console.error(e.message); process.exit(1) })
