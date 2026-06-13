import { createClient } from '@supabase/supabase-js'
import { sendDailyDigest, sendLeadDigest, sendOverdueReminder } from '@/lib/email'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

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

  const { data: events } = await supabase
    .from('events')
    .select('id, name, slug')
    .eq('status', 'active')

  if (!events?.length) return res.status(200).json({ ok: true, processed: 0 })

  let totalSent = 0

  for (const event of events) {
    const { data: activities } = await supabase
      .from('activities')
      .select('id, name, lead_id, co_lead_id')
      .eq('event_id', event.id)

    const activityIds = (activities ?? []).map((a) => a.id)
    if (!activityIds.length) continue

    const { data: allTasks } = await supabase
      .from('tasks')
      .select('id, title, status, due_date, activity_id, assignee_1_id, assignee_2_id')
      .in('activity_id', activityIds)

    if (!allTasks?.length) continue

    const overdueTasks = allTasks.filter(
      (t) => t.status !== 'done' && t.due_date && new Date(t.due_date) < today
    )

    // Load already-sent log for today to avoid duplicates
    const { data: sentToday } = await supabase
      .from('email_log')
      .select('user_id, type')
      .eq('event_id', event.id)
      .gte('sent_at', todayStr)

    const alreadySent = new Set((sentToday ?? []).map((e) => `${e.user_id}:${e.type}`))

    const { data: members } = await supabase
      .from('event_members')
      .select('user_id, role')
      .eq('event_id', event.id)

    if (!members?.length) continue

    const { data: users } = await supabase
      .from('users')
      .select('id, name, email, lang')
      .in('id', members.map((m) => m.user_id))
      .not('name', 'is', null) // skip placeholder invited users

    const userMap = Object.fromEntries((users ?? []).map((u) => [u.id, u]))

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
      await sendOverdueReminder(userMap[uid], tasks, event.slug, event.id)
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
      await sendDailyDigest(user, userTasks, event.slug, event.id)
      alreadySent.add(`${user.id}:daily_digest`)
      totalSent++
    }

    // Lead digest — per activity, to lead and co-lead
    for (const activity of (activities ?? [])) {
      for (const leadId of [activity.lead_id, activity.co_lead_id].filter(Boolean)) {
        const user = userMap[leadId]
        if (!user) continue
        const key = `${user.id}:lead:${activity.id}`
        if (alreadySent.has(key)) continue

        const activityTasks = allTasks.filter((t) => t.activity_id === activity.id)
        await sendLeadDigest(user, activity, activityTasks, event.slug, event.id)
        alreadySent.add(key)
        totalSent++
      }
    }
  }

  return res.status(200).json({ ok: true, sent: totalSent })
}
