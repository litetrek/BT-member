const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

function loadEnv() {
  const lines = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split('\n')
  const env = {}
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
  }
  return env
}

async function main() {
  const env = loadEnv()
  const fixed = env.DIRECT_URL.replace(
    /^(postgresql:\/\/[^:]+:)(.+?)(@[^@]+:\d+\/.+)$/,
    (_, prefix, pass, suffix) => prefix + encodeURIComponent(pass) + suffix
  )
  const client = new Client({ connectionString: fixed, ssl: { rejectUnauthorized: false } })
  await client.connect()

  await client.query(`
    DROP POLICY IF EXISTS "events_select" ON events;
    CREATE POLICY "events_select" ON events FOR SELECT USING (true);
  `)
  console.log('events_select policy updated — public read enabled.')
  await client.end()
}

main().catch((e) => { console.error(e.message); process.exit(1) })
