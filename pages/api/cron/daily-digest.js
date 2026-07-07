import { query } from '@/lib/db'
import { sendDailyDigest, sendLeadDigest, sendOverdueReminder } from '@/lib/email'

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).end()
  }

  if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]

  const { rows: events } = await query(
    "SELECT id, name, slug FROM events WHERE status = 'active'"
  )
  if (!events?.length) return res.status(200).json({ ok: true, processed: 0 })

  let totalSent = 0

  for (const event of events) {
    const { rows: activities } = await query(
      'SELECT id, name, lead_id, co_lead_id FROM activities WHERE event_id = $1',
      [event.id]
    )
    const activityIds = activities.map((a) => a.id)
    if (!activityIds.length) continue

    const { rows: allTasks } = await query(
      `SELECT id, title, status, due_date, activity_id, assignee_1_id, assignee_2_id
       FROM tasks WHERE activity_id = ANY($1)`,
      [activityIds]
    )
    if (!allTasks?.length) continue

    const overdueTasks = allTasks.filter(
      (t) => t.status !== 'done' && t.due_date && new Date(t.due_date) < today
    )

    const { rows: sentToday } = await query(
      'SELECT user_id, type FROM email_log WHERE event_id = $1 AND sent_at >= $2::date',
      [event.id, todayStr]
    )
    const alreadySent = new Set((sentToday ?? []).map((e) => `${e.user_id}:${e.type}`))

    const { rows: members } = await query(
      'SELECT user_id, role FROM event_members WHERE event_id = $1',
      [event.id]
    )
    if (!members?.length) continue

    const memberIds = members.map((m) => m.user_id)
    const { rows: users } = await query(
      `SELECT id, name, email, preferred_lang FROM users
       WHERE id = ANY($1) AND name IS NOT NULL`,
      [memberIds]
    )
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]))

    // Overdue reminders — one email per assignee (consolidated)
    const overdueByUser = {}
    for (const task of overdueTasks) {
      for (const uid of [task.assignee_1_id, task.assignee_2_id].filter(Boolean)) {
        if (!userMap[uid]) continue
        if (!overdueByUser[uid]) overdueByUser[uid] = []
        overdueByUser[uid].push(task)
      }
    }
    for (const [uid, tasks] of Object.entries(overdueByUser)) {
      if (alreadySent.has(`${uid}:overdue_reminder`)) continue
      await sendOverdueReminder(userMap[uid], tasks, event.slug, event.id, userMap[uid].preferred_lang ?? 'zh')
      alreadySent.add(`${uid}:overdue_reminder`)
      totalSent++
    }

    // Daily digest — all assigned tasks per member
    for (const member of members) {
      const user = userMap[member.user_id]
      if (!user) continue
      if (alreadySent.has(`${user.id}:daily_digest`)) continue
      const userTasks = allTasks.filter(
        (t) => t.assignee_1_id === user.id || t.assignee_2_id === user.id
      )
      await sendDailyDigest(user, userTasks, event.slug, event.id, user.preferred_lang ?? 'zh')
      alreadySent.add(`${user.id}:daily_digest`)
      totalSent++
    }

    // Lead digest — per activity, to lead and co-lead
    for (const activity of activities) {
      for (const leadId of [activity.lead_id, activity.co_lead_id].filter(Boolean)) {
        const user = userMap[leadId]
        if (!user) continue
        const key = `${user.id}:lead_digest`
        if (alreadySent.has(key)) continue
        const activityTasks = allTasks.filter((t) => t.activity_id === activity.id)
        await sendLeadDigest(user, activity, activityTasks, event.slug, event.id, user.preferred_lang ?? 'zh')
        alreadySent.add(key)
        totalSent++
      }
    }
  }

  return res.status(200).json({ ok: true, sent: totalSent })
}
