import { query } from '@/lib/db'
import { importGuard } from '@/lib/importApi'

// GET /api/import/context?event_id=  → what the import page needs to match and preview:
// activities, everyone who can be a reporter/owner, and remembered sender matches.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).end()
  }
  const ctx = await importGuard(req, res, req.query.event_id)
  if (!ctx) return

  const eventId = ctx.event.id
  const [{ rows: activities }, { rows: members }, { rows: senderMap }, { rows: [counts] }] = await Promise.all([
    query('SELECT id, name, icon FROM activities WHERE event_id = $1 ORDER BY sort_order', [eventId]),
    // Event members first; all named users are offered too (helpers who never joined
    // this event can still be matched), flagged so the page can sort them.
    query(
      `SELECT u.id, u.name, u.email, u.avatar_url, (m.user_id IS NOT NULL) AS is_member
       FROM users u
       LEFT JOIN event_members m ON m.user_id = u.id AND m.event_id = $1
       WHERE u.name IS NOT NULL OR m.user_id IS NOT NULL
       ORDER BY (m.user_id IS NULL), u.name`,
      [eventId]
    ),
    query('SELECT sender_name, user_id FROM import_sender_map WHERE event_id = $1', [eventId]),
    query('SELECT count(*)::int AS n FROM import_messages WHERE event_id = $1', [eventId]),
  ])

  return res.status(200).json({
    event: ctx.event,
    activities,
    members,
    sender_map: Object.fromEntries(senderMap.map((r) => [r.sender_name, r.user_id])),
    imported_messages: counts.n,
  })
}
