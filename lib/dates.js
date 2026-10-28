// Date-only helpers for DATE columns (tasks.due_date, events.event_date).
//
// lib/db.js makes pg return DATE columns as plain 'YYYY-MM-DD' strings. These helpers
// compare and format them as calendar dates, never through UTC midnight, so a task due
// today is not "overdue" in California and June 30 never displays as June 29.

const SERVER_TZ = 'America/Los_Angeles'

// Accepts 'YYYY-MM-DD', a full ISO string, or a Date; returns 'YYYY-MM-DD' or null.
export function toDateOnly(value) {
  if (!value) return null
  if (value instanceof Date) {
    if (isNaN(value)) return null
    return value.toISOString().slice(0, 10)
  }
  const s = String(value)
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null
}

// Today's calendar date. In the browser: the viewer's local date.
// On the server (Vercel runs in UTC): the team's local date in California.
export function todayISO() {
  const opts = { year: 'numeric', month: '2-digit', day: '2-digit' }
  if (typeof window === 'undefined') opts.timeZone = SERVER_TZ
  return new Intl.DateTimeFormat('en-CA', opts).format(new Date())
}

export function isPastDate(value, today = todayISO()) {
  const d = toDateOnly(value)
  return !!d && d < today
}

export function isOverdue(task, today = todayISO()) {
  return !!task && task.status !== 'done' && isPastDate(task.due_date, today)
}

// Formats a date-only value for display; returns '' when missing or unparseable.
export function formatDateOnly(value, locale = 'zh-TW', opts = { year: 'numeric', month: 'long', day: 'numeric' }) {
  const d = toDateOnly(value)
  if (!d) return ''
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString(locale, opts)
}

export function yearOf(value) {
  const d = toDateOnly(value)
  return d ? d.slice(0, 4) : ''
}
