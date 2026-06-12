// One-time migration: schema additions for Day 5
// Usage: node scripts/migrate.js

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
    name: '1. Add task_type column to tasks',
    sql: `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_type text DEFAULT 'general';`,
  },
  {
    name: '2. Create task_types table',
    sql: `
CREATE TABLE IF NOT EXISTS task_types (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid REFERENCES events(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);
    `.trim(),
  },
  {
    name: '3. Enable RLS on task_types',
    sql: `ALTER TABLE task_types ENABLE ROW LEVEL SECURITY;`,
  },
  {
    name: '4. RLS policy: members can read task types',
    sql: `
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'task_types' AND policyname = 'Members can read task types'
  ) THEN
    CREATE POLICY "Members can read task types"
    ON task_types FOR SELECT
    USING (
      event_id IN (
        SELECT event_id FROM event_members WHERE user_id = auth.uid()
      )
    );
  END IF;
END $$;
    `.trim(),
  },
  {
    name: '5. RLS policy: admin can manage task types',
    sql: `
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'task_types' AND policyname = 'Admin can manage task types'
  ) THEN
    CREATE POLICY "Admin can manage task types"
    ON task_types FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM event_members
        WHERE event_id = task_types.event_id
          AND user_id = auth.uid()
          AND role = 'admin'
      )
    );
  END IF;
END $$;
    `.trim(),
  },
  {
    name: '6. Add activity_id to announcements',
    sql: `ALTER TABLE announcements ADD COLUMN IF NOT EXISTS activity_id uuid REFERENCES activities(id) ON DELETE SET NULL;`,
  },
  {
    name: '7. Add reporter_id to announcements',
    sql: `ALTER TABLE announcements ADD COLUMN IF NOT EXISTS reporter_id uuid REFERENCES users(id) ON DELETE SET NULL;`,
  },
  {
    name: '8. Add reported_at to announcements',
    sql: `ALTER TABLE announcements ADD COLUMN IF NOT EXISTS reported_at timestamptz;`,
  },
]

async function main() {
  const env = loadEnv()
  const connStr = env.DIRECT_URL

  if (!connStr) {
    console.error('DIRECT_URL not found in .env.local')
    process.exit(1)
  }

  const fixed = connStr.replace(
    /^(postgresql:\/\/[^:]+:)(.+?)(@[^@]+:\d+\/.+)$/,
    (_, prefix, pass, suffix) => prefix + encodeURIComponent(pass) + suffix
  )

  const client = new Client({ connectionString: fixed, ssl: { rejectUnauthorized: false } })

  try {
    await client.connect()
    console.log('Connected to Supabase.\n')

    for (const step of DDL) {
      try {
        await client.query(step.sql)
        console.log(`✓  ${step.name}`)
      } catch (err) {
        console.error(`✗  ${step.name}: ${err.message}`)
      }
    }

    console.log('\nMigration complete.')
  } catch (err) {
    console.error('Connection error:', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
