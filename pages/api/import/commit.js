import { createHash } from 'node:crypto'
import pool, { insertLog } from '@/lib/db'
import { importGuard, isUuid } from '@/lib/importApi'

// POST /api/import/commit — saves what the coordinator approved on the preview screen.
// {
//   event_id, source: 'whatsapp' | 'sms',
//   messages:  [{ key, index, at_iso, sender, text, attachment? }]   every message in this import
//   sender_map: { "WhatsApp name": user_id | null },
//   status_updates: [{ messages: [index], activity_id, reporter_id, summary }],
//   tasks:          [{ messages: [index], activity_id, owner_id, title, due_date, status }],
//   photos:         [{ message: index, activity_id, caption, url, thumb_url }]
// }
// All in one transaction. Every message is recorded as imported (so a re-import skips
// it), and items carry a source_key so a double-click can't save anything twice.
export const config = { api: { bodyParser: { sizeLimit: '4mb' } } }

const STATUSES = new Set(['open', 'in_progress', 'done'])
const SOURCES = new Set(['whatsapp', 'sms'])
const shortHash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 32)
const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '')

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).end()
  }
  const body = req.body ?? {}
  const ctx = await importGuard(req, res, body.event_id)
  if (!ctx) return
  const { session, event } = ctx
  const source = SOURCES.has(body.source) ? body.source : 'whatsapp'

  const messages = (Array.isArray(body.messages) ? body.messages : []).filter(
    (m) => m && typeof m.key === 'string' && Number.isInteger(m.index)
  )
  if (!messages.length) return res.status(400).json({ error: '沒有訊息可匯入' })
  const byIndex = new Map(messages.map((m) => [m.index, m]))

  const sourceText = (indexes) =>
    indexes
      .map((i) => byIndex.get(i))
      .filter(Boolean)
      .map((m) => `${String(m.at_iso ?? '').slice(0, 16).replace('T', ' ')} ${m.sender}: ${m.text || (m.attachment ? '[照片]' : '')}`)
      .join('\n')
      .slice(0, 4000)
  const validIdx = (list) => (Array.isArray(list) ? list : []).map(Number).filter((n) => byIndex.has(n))
  const keyFor = (kind, idx, ordinal) =>
    `${event.id}:${kind}:${shortHash(idx.map((i) => byIndex.get(i).key).join('+') + ':' + ordinal)}`
  const atOf = (i) => {
    const d = new Date(byIndex.get(i)?.at_iso)
    return isNaN(d) ? null : d.toISOString()
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Only ids that really belong to this event / exist are accepted.
    const { rows: acts } = await client.query('SELECT id FROM activities WHERE event_id = $1', [event.id])
    const actIds = new Set(acts.map((a) => a.id))
    const userIdsWanted = [
      ...Object.values(body.sender_map ?? {}),
      ...(body.status_updates ?? []).map((u) => u?.reporter_id),
      ...(body.tasks ?? []).map((t) => t?.owner_id),
    ].filter(isUuid)
    const { rows: users } = userIdsWanted.length
      ? await client.query('SELECT id FROM users WHERE id = ANY($1)', [[...new Set(userIdsWanted)]])
      : { rows: [] }
    const userIds = new Set(users.map((u) => u.id))
    const act = (id) => (actIds.has(id) ? id : null)
    const user = (id) => (userIds.has(id) ? id : null)

    const saved = { status_updates: 0, tasks: 0, photos: 0, skipped_tasks_without_activity: 0 }
    const ordinals = new Map()
    const nextOrdinal = (kind, idx) => {
      const k = kind + idx.join(',')
      const n = (ordinals.get(k) ?? 0) + 1
      ordinals.set(k, n)
      return n
    }

    for (const u of Array.isArray(body.status_updates) ? body.status_updates : []) {
      const idx = validIdx(u?.messages)
      const summary = clip(u?.summary, 1000)
      if (!idx.length || !summary) continue
      const { rowCount } = await client.query(
        `INSERT INTO announcements
           (event_id, message, created_by, activity_id, reporter_id, reported_at,
            source, source_key, source_text, imported_by_ai)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)
         ON CONFLICT (source_key) WHERE source_key IS NOT NULL DO NOTHING`,
        [event.id, summary, session.user.id, act(u.activity_id), user(u.reporter_id), atOf(idx[0]),
         source, keyFor('su', idx, nextOrdinal('su', idx)), sourceText(idx)]
      )
      saved.status_updates += rowCount
    }

    for (const t of Array.isArray(body.tasks) ? body.tasks : []) {
      const idx = validIdx(t?.messages)
      const title = clip(t?.title, 300)
      if (!idx.length || !title) continue
      const activityId = act(t.activity_id)
      if (!activityId) { saved.skipped_tasks_without_activity++; continue } // tasks.activity_id is required
      const due = typeof t.due_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.due_date) ? t.due_date : null
      const { rowCount } = await client.query(
        `INSERT INTO tasks
           (activity_id, title, status, assignee_1_id, due_date, task_type, created_by,
            source, source_key, source_text, imported_by_ai)
         VALUES ($1,$2,$3,$4,$5,'general',$6,$7,$8,$9,true)
         ON CONFLICT (source_key) WHERE source_key IS NOT NULL DO NOTHING`,
        [activityId, title, STATUSES.has(t.status) ? t.status : 'open',
         user(t.owner_id) ?? session.user.id, due, session.user.id,
         source, keyFor('task', idx, nextOrdinal('task', idx)), sourceText(idx)]
      )
      saved.tasks += rowCount
    }

    for (const p of Array.isArray(body.photos) ? body.photos : []) {
      const m = byIndex.get(Number(p?.message))
      const url = clip(p?.url, 1000)
      if (!m || !/^https:\/\//.test(url)) continue
      const thumb = /^https:\/\//.test(p?.thumb_url ?? '') ? p.thumb_url.slice(0, 1000) : null
      const { rowCount } = await client.query(
        `INSERT INTO activity_photos
           (event_id, activity_id, url, thumb_url, caption, taken_at, sender_name, source, source_key, uploaded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (source_key) WHERE source_key IS NOT NULL DO NOTHING`,
        [event.id, act(p.activity_id), url, thumb, clip(p.caption, 300) || null, atOf(m.index),
         m.sender, source, `${event.id}:photo:${m.key}`, session.user.id]
      )
      saved.photos += rowCount
    }

    // Remember every message (even chit-chat) so the next import of a newer export skips it.
    await client.query(
      `INSERT INTO import_messages (event_id, msg_key, source)
       SELECT $1, k, $3 FROM unnest($2::text[]) AS k
       ON CONFLICT DO NOTHING`,
      [event.id, messages.map((m) => m.key), source]
    )

    for (const [name, uid] of Object.entries(body.sender_map ?? {})) {
      if (!name || name.length > 100) continue
      await client.query(
        `INSERT INTO import_sender_map (event_id, sender_name, user_id, updated_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (event_id, sender_name) DO UPDATE SET user_id = EXCLUDED.user_id, updated_at = now()`,
        [event.id, name, user(uid)]
      )
    }

    await client.query('COMMIT')

    await insertLog({
      event_id:    event.id,
      user_id:     session.user.id,
      entity_type: 'import',
      entity_name: source === 'sms' ? '簡訊匯入' : 'WhatsApp 匯入',
      action:      'created',
      note:        `${messages.length} messages → ${saved.status_updates} updates, ${saved.tasks} tasks, ${saved.photos} photos`,
    }).catch(() => {})

    return res.status(200).json({ ok: true, saved, messages: messages.length })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('[import commit]', err.code ?? '', err.message)
    return res.status(500).json({ error: '儲存失敗，沒有任何資料被寫入。請稍後再試。' })
  } finally {
    client.release()
  }
}
