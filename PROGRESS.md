# BT-Member Event Management — Progress Snapshot

## Day 4 Complete — Task Description, Title Edit Permissions, AI Chat Q&A

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
- `CREATE TABLE activity_log` — entity-based audit log

**API**
- `GET /api/log?event_id=&task_id=&hours=` — returns log entries with actor info
- All existing routes now insert to `activity_log` on mutation

### Task Detail Modal

**`components/TaskDetail.jsx`** — full-screen modal (sheet on mobile, centered on sm+)
- Top: task title, activity name, current status badge, due date, assignee avatars
- Middle: status select + note textarea + Update button (visible to assignees, admin, lead)
- Bottom: history list from `/api/log?task_id=` — Chinese natural language descriptions per action

### AI Summary Dashboard

**`pages/api/ai/summary.js`**
- `GET /api/ai/summary?event_id=&hours=` — admin/lead only
- Chinese-only prompt, `max_tokens` 400, model `claude-sonnet-4-6`
- **Requires `ANTHROPIC_API_KEY` in `.env.local` and Vercel env vars**

**`components/AISummary.jsx`**
- Time range selector: 最近 4 小時 / 最近 24 小時 / 最近 7 天
- 朗讀/停止 button using Web Speech API (lang: zh-TW, rate: 0.9)
- Shown on dashboard for admin/lead only

### Mobile Layout — Bottom Tab Bar

**`components/Layout.jsx`** completely redesigned:
- Inline SVG icons (no CDN dependency — fixes iOS Safari rendering)
- Fixed bottom tab bar (`sm:hidden`) — tabs for 總覽, 活動, 任務, 成員
- Desktop top nav unchanged (`hidden sm:flex`)
- `pb-24 sm:pb-8` on main to prevent bottom tab overlap

---

## Day 3 Patch — activity_log Schema Corrected

**Corrected `activity_log` table** — run in Supabase SQL Editor:
```sql
DROP TABLE IF EXISTS activity_log;
CREATE TABLE activity_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid REFERENCES events(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES users(id) ON DELETE SET NULL,
  entity_type   text NOT NULL,
  entity_id     uuid,
  entity_name   text,
  action        text NOT NULL,
  field_changed text,
  old_value     text,
  new_value     text,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "log_select" ON activity_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM event_members WHERE event_id = activity_log.event_id AND user_id = auth.uid())
);
CREATE POLICY "log_insert" ON activity_log FOR INSERT WITH CHECK (auth.role() = 'authenticated');
```

---

## Day 3 Patch 3 — Traditional Chinese UI + Status Updates + Mobile Font

### Changes Made

**`pages/api/announcements/index.js`**
- POST permission: `role !== 'admin'` → `!['admin','lead'].includes(role)`
- Leaders can now post status updates

**`styles/globals.css`**
- Added `@media (max-width: 640px) { html { font-size: 18px; } }` — +2px mobile font

**All UI text converted to Traditional Chinese:**

- `components/StatusBadge.jsx` — Open→未開始, In Progress→進行中, Done→已完成, Overdue→逾期
- `components/ConfirmDialog.jsx` — Cancel→取消, default confirmLabel→刪除
- `components/ActivityCard.jsx` — "tasks done"→個任務已完成, Edit→編輯, Delete→刪除
- `components/TaskForm.jsx` — all labels (標題, 活動, 狀態, 負責人一/二, 到期日, 刪除任務, 取消, 儲存)
- `components/ActivityForm.jsx` — all labels (名稱, 圖示, 負責人, 協助人, 取消, 儲存)
- `components/InviteForm.jsx` — all labels; roles: 一般成員/負責人/管理員
- `components/TaskDetail.jsx` — all labels; history descriptions in Chinese; relative time in Chinese
- `components/AISummary.jsx` — time ranges: 最近 4 小時 / 最近 24 小時 / 最近 7 天
- `components/Layout.jsx` — desktop nav uses Chinese labels; 登出
- `pages/index.jsx` — 佛誕活動, 進行中/已結束 status badges, 載入中…, 尚無活動
- `pages/[slug]/index.jsx` — 以 Google 帳號登入, 僅限團隊成員 · 需要邀請
- `pages/[slug]/dashboard.jsx` — 總覽, 總任務/已完成/進行中/逾期, 我的任務, 活動進度
- `pages/[slug]/activities.jsx` — 活動, 狀態更新 (was Announcements), 發佈, 新增活動
- `pages/[slug]/tasks.jsx` — 任務, 全部活動, 全部狀態, section titles all Chinese, 新增任務
- `pages/[slug]/admin/users.jsx` — 團隊成員, 成員/電子郵件/角色/狀態, 活躍/待確認, 編輯成員, 移除

---

## What Was Built — Day 4

### A. Task Description Field

**Supabase migration** (must be run manually in SQL Editor):
```sql
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description text;
```

**`prisma/schema.prisma`**
- Added `description String?` to Task model (reference only, not used by ORM)

**`pages/api/tasks/index.js`** (rewritten)
- POST now accepts `description` from req.body
- Inserts `description: description || null` into tasks row
- Logs description on creation if non-empty: `field_changed='description'`, truncated to 100 chars

**`pages/api/tasks/[id].js`** (rewritten — three-tier permission model)
- Fetches task upfront (including `created_by`) to support permission checks + logging
- Three permission tiers:
  1. **Admin/lead** — all fields (activity_id, assignees, due_date, status, note, title, description)
  2. **Assignee** (assignee_1_id or assignee_2_id) — status, note, title, description
  3. **Creator** (created_by = userId) — title, description only
- Non-permitted fields silently ignored (no 403 for partial payloads)
- Description changes logged with truncation to 100 chars

**`components/TaskForm.jsx`**
- Added `description: ''` to form state
- Edit useEffect hydrates `description: task.description ?? ''`
- Textarea field below title: label 任務描述, 3 rows, placeholder 請輸入任務說明（選填）, no validation
- Submit body includes `description: form.description || null`

**`components/TaskDetail.jsx`**
- Read-only description display below modal header (only shown when `task.description` is non-null)
- Styled: `bg-gray-50 rounded px-3 py-2 leading-relaxed whitespace-pre-wrap`

### B. Task Title Edit Permissions

**`components/TaskDetail.jsx`** — inline title editing
- Added state: `displayTitle`, `editingTitle`, `titleDraft`, `titleSaving`
- Permission: `canEditTitle = isAssignee || isCreator || ['admin','lead'].includes(userRole)`
- Eligible users: title h2 is clickable (cursor-pointer, hover:text-blue-600, tooltip 點擊以編輯標題)
- Clicking replaces h2 with input + 儲存/取消 buttons
- Enter saves, Escape cancels; saving PUTs `{ title }` only to `/api/tasks/[id]`
- Non-eligible users: title is plain text, no interaction

### C. AI Chat Q&A

**`pages/api/ai/chat.js`** (new)
- POST, admin/lead only
- Accepts: `event_id`, `question`, `conversation_history` (array, sliced to last 10)
- Fetches: activities → (parallel) tasks, activity_log (30 days, 50 entries), announcements (30 days, 20 entries)
- Chinese system prompt includes: [活動列表], [任務列表], [最近30天紀錄], [最近公告]
- Model: `claude-sonnet-4-6`, `max_tokens: 400`
- Returns: `{ answer, updated_history }`

**`components/AIChat.jsx`** (new)
- Multi-turn chat UI; client owns conversation history (not persisted)
- User bubbles: right-aligned blue; assistant: left-aligned gray
- `content: null` → "思考中…" italic in pending bubble
- Error → "抱歉，無法取得回應，請再試一次。"
- Enter (without Shift) sends; 清除對話 button resets messages + history
- Auto-scrolls to bottom on new messages via ref

**`pages/[slug]/dashboard.jsx`**
- Imports `AIChat`
- Renders `<AIChat eventId={eventId} />` below `<AISummary />` inside the `canSeeAI && eventId` block

---

## Current State

- Full Traditional Chinese UI across all pages and components
- Three-tier task permission model: admin/lead → assignee → creator
- Task description field: create/edit in TaskForm, read-only display in TaskDetail
- Inline title editing in TaskDetail for eligible users
- AI Summary + AI Chat Q&A on dashboard (admin/lead only)
- Mobile: fixed bottom tab bar with inline SVG icons
- 狀態更新 postable by admin or lead

---

## Pending / Supabase Manual Steps

- **Run description DDL in Supabase SQL Editor:**
  ```sql
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description text;
  ```
- **`ANTHROPIC_API_KEY`** must be set in `.env.local` and Vercel env vars
- **`CRON_SECRET`** must be set in Vercel environment variables
- Trigger announcement emails from Activities page (currently only posted to DB)
- Test Google sign-in end-to-end with real user, verify role propagation
- Consider per-event role context (currently uses highest role across all events)
