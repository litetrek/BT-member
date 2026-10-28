// Merge a duplicate user account into the one you keep.
//
// Every column with a foreign key to users(id) is re-pointed from the duplicate to the
// kept account (found from the database catalog, so tables added later are covered).
// Where the kept account already has the same row (e.g. it is already a member of the
// same event), the duplicate's row is dropped instead. Finally the duplicate user row
// is deleted. Everything runs in one transaction.
//
// Usage:
//   node scripts/merge-duplicate-user.js --list                 # show users to pick from
//   node scripts/merge-duplicate-user.js <keep-id> <dup-id>     # dry run: shows what would change
//   node scripts/merge-duplicate-user.js <keep-id> <dup-id> --apply

const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local')
  if (!fs.existsSync(envPath)) return {}
  const env = {}
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const s = line.trim()
    if (!s || s.startsWith('#')) continue
    const eq = s.indexOf('=')
    if (eq === -1) continue
    env[s.slice(0, eq).trim()] = s.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
  }
  return env
}

const ident = (s) => '"' + String(s).replace(/"/g, '""') + '"'

async function main() {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  const list = args.includes('--list')
  const [keepId, dupId] = args.filter((a) => !a.startsWith('--'))

  const env = { ...loadEnv(), ...process.env }
  const client = new Client({
    connectionString: env.DIRECT_URL || env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()

  try {
    if (list || !keepId || !dupId) {
      const { rows } = await client.query(
        `SELECT u.id, u.name, u.email,
                (SELECT count(*) FROM tasks t WHERE t.assignee_1_id = u.id OR t.assignee_2_id = u.id) AS tasks,
                (SELECT count(*) FROM event_members m WHERE m.user_id = u.id) AS events
         FROM users u ORDER BY u.name, u.email`
      )
      console.table(rows)
      if (!list) console.log('\nUsage: node scripts/merge-duplicate-user.js <keep-id> <dup-id> [--apply]')
      return
    }
    if (keepId === dupId) throw new Error('keep-id and dup-id must differ')

    const { rows: users } = await client.query(
      'SELECT id, name, email FROM users WHERE id = ANY($1)', [[keepId, dupId]]
    )
    const keep = users.find((u) => u.id === keepId)
    const dup = users.find((u) => u.id === dupId)
    if (!keep || !dup) throw new Error('Both user ids must exist')
    console.log(`KEEP  ${keep.id}  ${keep.name} <${keep.email}>`)
    console.log(`MERGE ${dup.id}  ${dup.name} <${dup.email}>  (will be deleted)\n`)

    // All single-column FKs that reference users(id).
    const { rows: fks } = await client.query(`
      SELECT cl.relname AS tbl, att.attname AS col
      FROM pg_constraint con
      JOIN pg_class cl       ON cl.oid = con.conrelid
      JOIN pg_namespace ns   ON ns.oid = cl.relnamespace
      JOIN pg_attribute att  ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
      WHERE con.contype = 'f'
        AND con.confrelid = 'public.users'::regclass
        AND array_length(con.conkey, 1) = 1
        AND ns.nspname = 'public'
      ORDER BY 1, 2`)

    await client.query('BEGIN')

    for (const { tbl, col } of fks) {
      const { rows: [{ n }] } = await client.query(
        `SELECT count(*)::int AS n FROM ${ident(tbl)} WHERE ${ident(col)} = $1`, [dupId]
      )
      if (!n) continue
      // Update row by row inside a savepoint so a unique clash (the kept account
      // already has an equivalent row) drops the duplicate's row instead of failing.
      const { rows: ctids } = await client.query(
        `SELECT ctid::text AS ctid FROM ${ident(tbl)} WHERE ${ident(col)} = $1`, [dupId]
      )
      let moved = 0, dropped = 0
      for (const { ctid } of ctids) {
        await client.query('SAVEPOINT row_sp')
        try {
          await client.query(
            `UPDATE ${ident(tbl)} SET ${ident(col)} = $1 WHERE ctid = $2::tid`, [keepId, ctid]
          )
          await client.query('RELEASE SAVEPOINT row_sp')
          moved++
        } catch (err) {
          await client.query('ROLLBACK TO SAVEPOINT row_sp')
          if (err.code !== '23505') throw err // only unique violations are expected
          await client.query(`DELETE FROM ${ident(tbl)} WHERE ctid = $1::tid`, [ctid])
          dropped++
        }
      }
      console.log(`${tbl}.${col}: ${moved} moved${dropped ? `, ${dropped} duplicate row(s) dropped` : ''}`)
    }

    await client.query('DELETE FROM users WHERE id = $1', [dupId])
    console.log(`users: deleted ${dup.email}`)

    if (apply) {
      await client.query('COMMIT')
      console.log('\nDone — changes committed.')
    } else {
      await client.query('ROLLBACK')
      console.log('\nDry run only — nothing was changed. Re-run with --apply to commit.')
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('Error:', err.message)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

main()
