import { t } from '@/lib/lang'
import { Resend } from 'resend'
import { query } from '@/lib/db'
import { render } from '@react-email/render'
import React from 'react'
import DailyDigestEmail from '@/emails/DailyDigest'
import LeadDigestEmail from '@/emails/LeadDigest'
import OverdueReminderEmail from '@/emails/OverdueReminder'
import AnnouncementEmail from '@/emails/Announcement'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = 'BT Member Portal <noreply@bt.cyber-tech.com>'

async function logEmail(eventId, userId, type, status) {
  await query(
    'INSERT INTO email_log (event_id, user_id, type, status) VALUES ($1, $2, $3, $4)',
    [eventId, userId, type, status]
  )
}

export async function sendDailyDigest(user, tasks, slug, eventId, lang = 'zh') {
  const subject = t(lang, 'Your Daily Task Summary', '今日任務摘要')

  let emailStatus = 'sent'
  try {
    const html = render(React.createElement(DailyDigestEmail, { user, tasks, slug, lang }))
    await resend.emails.send({ from: FROM, to: user.email, subject, html })
  } catch (err) {
    console.error('sendDailyDigest error:', err)
    emailStatus = 'failed'
  }
  await logEmail(eventId, user.id, 'daily_digest', emailStatus)
}

export async function sendLeadDigest(user, activity, tasks, slug, eventId, lang = 'zh') {
  const subject = t(lang, 'Activity Summary', '活動摘要')

  let emailStatus = 'sent'
  try {
    const html = render(React.createElement(LeadDigestEmail, { user, activity, tasks, slug, lang }))
    await resend.emails.send({ from: FROM, to: user.email, subject, html })
  } catch (err) {
    console.error('sendLeadDigest error:', err)
    emailStatus = 'failed'
  }
  await logEmail(eventId, user.id, 'lead_digest', emailStatus)
}

export async function sendOverdueReminder(user, tasks, slug, eventId, lang = 'zh') {
  const subject = t(lang, '⚠️ Overdue Tasks', '⚠️ 逾期任務提醒')

  let emailStatus = 'sent'
  try {
    const html = render(React.createElement(OverdueReminderEmail, { user, tasks, slug, lang }))
    await resend.emails.send({ from: FROM, to: user.email, subject, html })
  } catch (err) {
    console.error('sendOverdueReminder error:', err)
    emailStatus = 'failed'
  }
  await logEmail(eventId, user.id, 'overdue_reminder', emailStatus)
}

export async function sendAnnouncement(members, message, senderName, eventName, eventId) {
  const emails = members.map((m) => m.email).filter(Boolean)
  if (!emails.length) return

  let emailStatus = 'sent'
  try {
    // Announcement goes to all members; use English subject as it's a broadcast
    const html = render(React.createElement(AnnouncementEmail, { message, senderName, eventName }))
    await resend.emails.send({
      from: FROM,
      to: emails,
      subject: `Announcement · ${eventName}`,
      html,
    })
  } catch (err) {
    console.error('sendAnnouncement error:', err)
    emailStatus = 'failed'
  }
  for (const m of members) {
    await logEmail(eventId, m.id, 'announcement', emailStatus)
  }
}
