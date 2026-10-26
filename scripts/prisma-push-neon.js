// Runs `npx prisma db push` with DATABASE_URL loaded from .env.local.
// Prisma CLI only auto-reads .env, not .env.local, so this bridges the gap
// without having to export the raw connection string through a shell.
// Usage: node scripts/prisma-push-neon.js

const { spawnSync } = require('child_process')
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

const env = loadEnv()
if (!env.DATABASE_URL) {
  console.error('No DATABASE_URL found in .env.local')
  process.exit(1)
}

const result = spawnSync('npx', ['prisma', 'db', 'push'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, DATABASE_URL: env.DATABASE_URL },
})
process.exit(result.status ?? 1)
