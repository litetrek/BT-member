import pool, { query, insertLog } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Slugs that would collide with top-level routes (pages/admin, pages/inventory, /api …).
const RESERVED_SLUGS = new Set(['admin', 'api', 'inventory', 'login', 'new', '_next', 'public', 'static'])
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { rows } = await query(
      'SELECT * FROM events ORDER BY event_date DESC'
    )
    return res.status(200).json(rows)
  }

  // POST { name, slug, event_date: 'YYYY-MM-DD',
  //        copy_from?: event id,
  //        copy?: { members, activities, task_types, tasks } (booleans) }
  // Admin only. The creator becomes an admin of the new event. From copy_from it can
  // reuse the previous event's framework: team + roles, activities (name, icon, order,
  // leads), task types, and tasks as a fresh checklist (status reset to open; due dates
  // moved by the gap between the two event dates). Status updates and history are not copied.
  if (req.method === 'POST') {
    const session = await getServerSession(req, res, authOptions)
    if (!session || session.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const name = String(req.body?.name ?? '').trim()
    const slug = String(req.body?.slug ?? '').trim().toLowerCase()
    const eventDate = String(req.body?.event_date ?? '').trim()
    const copyFrom = req.body?.copy_from || null
    const want = req.body?.copy ?? {}
    const copy = {
      members:    !!copyFrom && !!want.members,
      activities: !!copyFrom && !!want.activities,
      task_types: !!copyFrom && !!want.task_types,
    }
    copy.tasks = copy.activities && !!want.tasks

    if (!name) return res.status(400).json({ error: '請輸入活動名稱', field: 'name' })
    if (!SLUG_RE.test(slug) || slug.length > 60) {
      return res.status(400).json({ error: '網址代碼只能使用小寫英文、數字和連字號（-）', field: 'slug' })
    }
    if (RESERVED_SLUGS.has(slug)) {
      return res.status(400).json({ error: '這個網址代碼已被系統使用，請換一個', field: 'slug' })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || isNaN(Date.parse(eventDate))) {
      return res.status(400).json({ error: '請選擇活動日期', field: 'event_date' })
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const { rows: [event] } = await client.query(
        `INSERT INTO events (name, slug, event_date, status)
         VALUES ($1, $2, $3, 'active')
         RETURNING *`,
        [name, slug, eventDate]
      )

      await client.query(
        `INSERT INTO event_members (event_id, user_id, role) VALUES ($1, $2, 'admin')`,
        [event.id, session.user.id]
      )

      const copied = { members: 0, activities: 0, task_types: 0, tasks: 0 }

      if (copyFrom) {
        const { rows: [source] } = await client.query('SELECT id FROM events WHERE id = $1', [copyFrom])
        if (!source) throw Object.assign(new Error('source event not found'), { status: 400 })
      }

      if (copy.members) {
        const { rowCount } = await client.query(
          `INSERT INTO event_members (event_id, user_id, role)
           SELECT $1, user_id, role FROM event_members
           WHERE event_id = $2 AND user_id <> $3`,
          [event.id, copyFrom, session.user.id]
        )
        copied.members = rowCount
      }

      if (copy.task_types) {
        // Copies all of them (defaults included): the task-type list only seeds defaults
        // for an event that has none, so copying just the custom ones would lose the defaults.
        const { rowCount } = await client.query(
          `INSERT INTO task_types (event_id, name, created_by)
           SELECT $1, name, $3 FROM task_types WHERE event_id = $2
           ORDER BY created_at`,
          [event.id, copyFrom, session.user.id]
        )
        copied.task_types = rowCount
      }

      if (copy.activities) {
        const { rows: oldActs } = await client.query(
          'SELECT * FROM activities WHERE event_id = $1 ORDER BY sort_order',
          [copyFrom]
        )
        const actMap = new Map()
        for (const a of oldActs) {
          const { rows: [na] } = await client.query(
            `INSERT INTO activities (event_id, lead_id, co_lead_id, name, icon, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [event.id, a.lead_id, a.co_lead_id, a.name, a.icon, a.sort_order]
          )
          actMap.set(a.id, na.id)
        }
        copied.activities = oldActs.length

        if (copy.tasks && oldActs.length) {
          for (const [oldId, newId] of actMap) {
            const { rowCount } = await client.query(
              `INSERT INTO tasks (activity_id, title, description, task_type, status,
                                  assignee_1_id, assignee_2_id, due_date, created_by)
               SELECT $1, t.title, t.description, t.task_type, 'open',
                      t.assignee_1_id, t.assignee_2_id,
                      t.due_date + ($3::date - src.event_date),
                      $4
               FROM tasks t
               JOIN events src ON src.id = $5
               WHERE t.activity_id = $2
               ORDER BY t.created_at`,
              [newId, oldId, eventDate, session.user.id, copyFrom]
            )
            copied.tasks += rowCount
          }
        }
      }

      await client.query('COMMIT')

      await insertLog({
        event_id:    event.id,
        user_id:     session.user.id,
        entity_type: 'event',
        entity_id:   event.id,
        entity_name: name,
        action:      'created',
        note:        copyFrom ? `copied from ${copyFrom}: ${JSON.stringify(copied)}` : null,
      }).catch(() => {})

      return res.status(201).json({ ...event, copied })
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {})
      if (err.status === 400) return res.status(400).json({ error: '找不到要複製的活動' })
      if (err.code === '23505') {
        return res.status(409).json({ error: '這個網址代碼已有活動使用，請換一個', field: 'slug' })
      }
      console.error('[events] create failed:', err.message)
      return res.status(500).json({ error: '建立失敗，請稍後再試' })
    } finally {
      client.release()
    }
  }

  res.setHeader('Allow', ['GET', 'POST'])
  res.status(405).end()
}
