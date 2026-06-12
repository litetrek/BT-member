# BT-Member Event Management — Progress Snapshot

## Day 3 Complete — Activity Log, Task Detail Modal, AI Summary, Mobile Polish

---

## What Was Built — Day 1 Foundation

**Project Setup**
- Next.js 14 (pages router), Tailwind CSS, ESLint
- Dependencies: `next-auth`, `@auth/supabase-adapter`, `@supabase/supabase-js`, `resend`
- `.env.local.example` with all required keys
- `next.config.js`, `tailwind.config.js`, `postcss.config.js`, `jsconfig.json`
- Tabler Icons loaded via CDN in `globals.css`

**Supabase**
- `supabase/schema.sql` — 7 tables with RLS:
  - `events`, `users`, `event_members`, `activities`, `tasks`, `announcements`, `email_log`
- `supabase/seed.sql` — seed event: BT Annual Event 2026 (slug: 2026-annual-event)
- Schema deployed live to Supabase via `scripts/run-schema.js`

**Lib Files (Day 1)**
- `lib/supabase/server.js` — server-side Supabase client (service role key, bypasses RLS)
- `lib/supabase/client.js` — browser Supabase singleton
- `lib/auth.js` — NextAuth config (Google provider, upserts user on sign-in)
- `lib/constants.js` — ICONS (10), STATUS_LIST, ROLES

**API Routes (Day 1)**
- `GET/POST /api/events`
- `GET/POST /api/activities?slug=` and `PUT/DELETE /api/activities/[id]`
- `GET/POST /api/announcements?event_id=`
- `GET /api/tasks?slug=` (basic)
- `GET /api/users?event_id=` (basic)
- `pages/api/auth/[...nextauth].js`

**Components (Day 1)**
- `Layout.jsx` — nav bar with event name, page links, user avatar, admin-only Users link
- `ActivityCard.jsx` — icon, lead/co-lead, progress bar, edit/delete (admin)
- `ActivityForm.jsx` — modal create/edit with IconPicker, lead/co-lead selects
- `IconPicker.jsx` — dropdown of 10 Tabler icons
- `Avatar.jsx` — initials circle or Google photo
- `StatusBadge.jsx` — open/in_progress/done/overdue with color coding

**Pages (Day 1)**
- `/` — Module home: event grid, active event highlighted, admin Add Event button
- `/[slug]` — Event login: Google sign-in, redirect to dashboard if already authed
- `/[slug]/dashboard` — Stats row, My Tasks, Activity Progress with progress bars
- `/[slug]/activities` — Activity grid + Announcements section with admin post form
- `/[slug]/tasks` — Stub task list

**Day 1 Deployment Fixes**
- Added `jsconfig.json` — `@/` path alias was not resolving
- Fixed RLS policy on `events` — changed to `USING (true)` for public home page
- Rewrote activities API — replaced broken Supabase join syntax with separate queries
- Added `Array.isArray()` guards in dashboard and activities pages
- Switched `lib/auth.js` to use `SUPABASE_SERVICE_ROLE_KEY` for user upsert
- Added `SUPABASE_SERVICE_ROLE_KEY` to `.env.local.example` and Vercel env vars

---

## What Was Built — Day 2

### Auth Fixes
- `lib/auth.js` — rewrote `requireAdmin` for pages router (`req, res` pattern, returns `true` if blocked)
- `lib/auth.js` — fixed session callback to return best role across all event memberships (admin > lead > member)

### Task Management

**API**
- `GET /api/tasks?slug=&activity_id=&status=` — enhanced with filters; joins assignee1/assignee2 user data; overdue computed server-side
- `POST /api/tasks` — create task (admin/lead only); requires `title`, `activity_id`, `assignee_1_id`
- `PUT /api/tasks/[id]` — status toggle (assignees or admin only) or full edit (admin/lead only)
- `DELETE /api/tasks/[id]` — admin only

**Components**
- `components/TaskItem.jsx` — checkbox (assignees only), title, StatusBadge, up to 2 assignee avatars, due date, edit button (admin/lead), deep-link highlight ring
- `components/TaskForm.jsx` — create/edit modal: title, activity select, status, assignee 1/2, due date; Delete task button triggers confirm dialog

**Page — `/[slug]/tasks`** (full rewrite)
- Filter bar: activity dropdown + status dropdown (all/open/in_progress/done/overdue)
- Add Task button (admin/lead only)
- Tasks partitioned into 4 sections: Overdue, In Progress, Open, Done
- Deep link: `?id=<task_id>` highlights and scrolls to matching task
- Loading spinner, empty states, error boundary

### User Admin

**API**
- `GET /api/users?event_id=` — enhanced to return `role`, `joined_at`, `status` (`active`|`invited`) per member; without `event_id` returns active-only list for form selects
- `POST /api/users/invite` — looks up user by email; creates placeholder row (`name=null`) if not found; adds to `event_members`; admin only
- `PUT /api/users/[id]` — inline role change; admin only
- `DELETE /api/users/[id]?event_id=` — remove from event_members; admin only

**Components**
- `components/InviteForm.jsx` — modal: name + email + role select; POSTs to `/api/users/invite`

**Page — `/[slug]/admin/users`** (new)
- Admin-only (redirects non-admins to dashboard)
- Team table: avatar, name, email, role badge, status badge, pencil + trash buttons
- Edit modal: change name + role (email read-only)
- Pending section: users with `name=null` (not yet signed in)
- Confirm dialog before remove; cannot remove self

**Pending invite tracking:** Users invited by email but not yet signed in have `name=null` in the `users` table. When they sign in via Google OAuth, the upsert fills in their name — distinguishing them from active members automatically.

### Email Cron (Resend + React Email)

**Packages added:** `@react-email/components`, `@react-email/render`

**Email Templates**
- `emails/DailyDigest.jsx` — assigned tasks list with status, due date, deep-link button; reply-to footer
- `emails/LeadDigest.jsx` — all activity tasks grouped by status (In Progress / Open / Done)
- `emails/OverdueReminder.jsx` — overdue tasks with red highlight, due date, deep-link button
- `emails/Announcement.jsx` — message content, sender name, date

**`lib/email.js`** — Resend helper functions:
- `sendDailyDigest(user, tasks, slug, eventId)` — logs to `email_log` (type: daily_digest)
- `sendLeadDigest(user, activity, tasks, slug, eventId)` — logs to `email_log` (type: daily_digest)
- `sendOverdueReminder(user, tasks, slug, eventId)` — logs to `email_log` (type: overdue_reminder)
- `sendAnnouncement(members, message, senderName, eventName, eventId)` — bulk send; logs to `email_log` (type: announcement)

**`/api/cron/daily-digest`** — Vercel cron endpoint
- Protected: `x-cron-secret` header must match `CRON_SECRET` env var
- Iterates active events; for each event:
  1. Sends consolidated OverdueReminder to each assignee with overdue tasks (deduped by `email_log`)
  2. Sends DailyDigest to every member (their assigned tasks)
  3. Sends LeadDigest to each activity's lead + co-lead
- Deep link format: `https://bt.cyber-tech.com/[slug]/tasks?id=[task_id]`

**`vercel.json`** — cron schedule: `0 14 * * *` (14:00 UTC = 7:00 AM Pacific)

### Day 2 Polish
- `components/Spinner.jsx` — used on tasks and users pages during loading
- `components/ConfirmDialog.jsx` — used before all delete/remove actions
- `components/ErrorBoundary.jsx` — React class boundary wrapping tasks page content
- Empty state messages on all list sections

---

## What Was Built — Day 3

### Activity Log

**Schema additions** (`supabase/schema.sql`)
- `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS note text` — optional task note
- `CREATE TABLE activity_log` — tracks all meaningful actions with `event_id`, `task_id`, `user_id`, `action`, `note`, `created_at`
  - `task_id` uses `ON DELETE SET NULL` — log entries survive task deletion
  - RLS: members can read their event's log; authenticated users can insert
- **Run in Supabase SQL Editor:**
  ```sql
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS note text;
  CREATE TABLE IF NOT EXISTS activity_log (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id uuid REFERENCES events(id) ON DELETE CASCADE,
    task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
    user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    action text NOT NULL,
    note text,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "log_select" ON activity_log FOR SELECT USING (
    EXISTS (SELECT 1 FROM event_members WHERE event_id = activity_log.event_id AND user_id = auth.uid())
  );
  CREATE POLICY "log_insert" ON activity_log FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  ```

**API**
- `GET /api/log?event_id=&task_id=&hours=` — returns log entries with user and task info; accepts either filter
- All existing routes now insert to `activity_log` on mutation:
  - tasks POST → `task_created`
  - tasks PUT → `task_status_changed` (with new status as note) or `task_note_updated` or `task_updated`
  - tasks DELETE → `task_deleted` (logged before delete so task_id FK is valid)
  - activities POST → `activity_created`
  - activities PUT → `activity_updated`
  - activities DELETE → `activity_deleted`
  - announcements POST → `announcement_created`

### Task Detail Modal

**`components/TaskDetail.jsx`** — full-screen modal (sheet on mobile, centered on sm+)
- Top: task title, activity name, current status badge, due date, assignee avatars
- Middle: status select + note textarea + Update button (visible to assignees, admin, lead)
- Bottom: history list from `/api/log?task_id=` — shows user avatar, action label, relative timestamp, note text
- Closes on backdrop click or × button

**`components/TaskItem.jsx`** updated
- Entire row is clickable — opens TaskDetail via `onOpen` prop
- Checkbox and pencil button use `e.stopPropagation()` to avoid triggering detail
- Cursor changed to pointer for the row

**`pages/[slug]/tasks.jsx`** updated
- Imports TaskDetail; `detailTask` state controls which task is open
- All Section components pass `onOpen={setDetailTask}`
- TaskDetail rendered below TaskForm with `onSaved={handleDetailSaved}` (refreshes task list)

**`pages/api/tasks/[id].js`** updated
- PUT now accepts `note` field alongside `status`
- Status/note-only path: detects when no full-edit fields present — allows assignees OR admin/lead
- Full-edit path: admin/lead only (unchanged behavior)
- Both paths write to `activity_log`

### AI Summary Dashboard

**`pages/api/ai/summary.js`** (new)
- `GET /api/ai/summary?event_id=&hours=` — admin/lead only
- Fetches recent `activity_log` entries for the event; formats as readable lines
- Calls Claude (`claude-sonnet-4-6`) via `@anthropic-ai/sdk` — 2–3 sentence prose summary
- Returns `{ summary, entry_count }`
- **Requires `ANTHROPIC_API_KEY` in `.env.local` and Vercel env vars**

**`components/AISummary.jsx`** (new)
- Time range selector: Last 4 hours / Last 24 hours / Last 7 days
- Generate button — fetches from `/api/ai/summary`; shows spinner while loading
- Displays summary text + entry count
- Shown on dashboard for admin/lead only

**`pages/[slug]/dashboard.jsx`** updated
- Imports AISummary; renders it between stat cards and the two-column section
- Visible only when `userRole` is admin or lead and `eventId` is available

### Mobile Layout Polish

**`components/Layout.jsx`** updated
- Added mobile hamburger menu (`ti-menu-2`) that opens a vertical nav drawer below the header
- Desktop nav unchanged (hidden on mobile with `sm:flex`)
- Nav items in drawer include icon + label
- Reduced padding: `px-4 sm:px-6` header and `px-4 sm:px-6 py-6 sm:py-8` main
- User name hidden on mobile to save space

**`pages/[slug]/dashboard.jsx`**
- Stat card grid: `gap-3 sm:gap-4`
- Activity progress section: `gap-6 lg:gap-8` for the two-column grid
- My Tasks item: truncate + gap for tight mobile widths

---

## Current State (after Day 3)

- All activity is tracked in `activity_log` — full audit trail
- Clicking a task row opens TaskDetail modal with status/note update + history
- AI Summary available on dashboard for admin/lead — summarizes recent activity in prose
- Layout has mobile-friendly hamburger nav drawer
- `@anthropic-ai/sdk@0.104.1` installed

---

## Pending / Next Steps

- **Run SQL in Supabase** — `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS note text` + full `activity_log` DDL (see Day 3 schema section above)
- **Add `ANTHROPIC_API_KEY`** to `.env.local` and Vercel env vars (AI summary won't work without it)
- Add `CRON_SECRET` to Vercel environment variables (cron endpoint needs it)
- Trigger announcement emails from the Activities page (currently only posted to DB)
- Test Google sign-in end-to-end with real user, verify role propagation
- Consider adding per-event role context (currently uses highest role across all events)
