# BT-Member Event Management — Progress Snapshot

## Day 6 Complete — Per-Member Language Preference (EN / ZH)

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
- `Avatar.jsx` — initials circle or Google photo (sizes: xs, sm, md)
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
- `pages/index.jsx` — 聖天湖佛教城, 進行中/已結束 status badges, 載入中…, 尚無活動
- `pages/[slug]/index.jsx` — 以 Google 帳號登入, 僅限團隊成員 · 需要邀請
- `pages/[slug]/dashboard.jsx` — 總覽, 總任務/已完成/進行中/逾期, 我的任務, 活動進度
- `pages/[slug]/activities.jsx` — 活動, 狀態更新 (was Announcements), 發佈, 新增活動
- `pages/[slug]/tasks.jsx` — 任務, 全部活動, 全部狀態, section titles all Chinese, 新增任務
- `pages/[slug]/admin/users.jsx` — 團隊成員, 成員/電子郵件/角色/狀態, 活躍/待確認, 編輯成員, 移除

---

## What Was Built — Day 4

### A. Task Description Field

**Supabase migration** (applied via script):
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

---

## What Was Built — Day 5

### Schema Changes (applied via `scripts/migrate.js`)
```sql
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_type text DEFAULT 'general';
CREATE TABLE IF NOT EXISTS task_types (id, event_id, name, created_by, created_at) + RLS;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS activity_id uuid REFERENCES activities(id);
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS reporter_id uuid REFERENCES users(id);
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS reported_at timestamptz;
```

### 1. AI 助理 Page

**`pages/[slug]/ai.jsx`** (new)
- Admin/lead only (redirects others to dashboard)
- Loads AISummary + AIChat in single page
- Route: `/[slug]/ai`

**`pages/[slug]/dashboard.jsx`** — AISummary and AIChat removed from dashboard; now on AI page only

### 2. Voice Input for AI Chat

**`components/AIChat.jsx`** — microphone button added beside text input
- Uses Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`)
- Button idle: mic SVG icon, gray border
- Recording: red border + pulse animation
- Transcript appended to input field (not auto-sent)
- `lang: 'zh-TW'` for Mandarin Traditional Chinese
- Tooltip: "語音輸入"
- Hidden if browser doesn't support SpeechRecognition

### 3. Status Update Redesign

**Schema:** `announcements.activity_id`, `announcements.reporter_id`, `announcements.reported_at`

**`components/StatusUpdateForm.jsx`** (new modal)
- Fields: 狀態更新內容 (textarea, required), 相關活動 (select, required), 回報人 (select, defaults to current user), 回報時間 (datetime-local, defaults to now)
- Fetches event members for reporter dropdown
- POSTs to `/api/announcements`; closes modal on success

**`pages/api/announcements/index.js`** (updated)
- GET: joins `activity:activity_id(name)`, `reporter:reporter_id(name, avatar_url)`
- POST: accepts `activity_id`, `reporter_id`, `reported_at`; logs to activity_log

**`pages/[slug]/activities.jsx`** — status update form replaced by "+ 新增狀態更新" button (admin/lead only) opening StatusUpdateForm modal

**Status update card display:**
- Message text
- 相關活動: linked (clicking filters updates to that activity)
- 回報人: avatar + name
- 回報時間: formatted in zh-TW locale
- "由 [name] 代為發佈" if poster ≠ reporter

### 4. Activity Click Filter

**`pages/[slug]/activities.jsx`**
- `selectedActivityId` state — null = show all
- Clicking activity card toggles selection (blue ring + bg-blue-50 + ✓ 已選取 tag)
- Status updates list filtered by `selectedActivityId` when set
- Filter label above status updates: "顯示：[activity name] 的狀態更新" + "× 清除篩選" button
- All: "所有狀態更新"
- Edit/Delete buttons in ActivityCard use `e.stopPropagation()` to prevent click-through

### 5. Nav Bar Redesign

**`components/Layout.jsx`** — desktop header completely redesigned:
- Left: house SVG icon → `https://bt.cyber-tech.com` (external, tooltip "返回首頁")
- Center: nav links (總覽 | 活動 | 任務 | AI 助理 | 成員), active = blue bg + text
- Right: user avatar (unchanged)
- "AI 助理" link shown only to admin/lead
- Mobile bottom tab bar: HOME tab (leftmost) + all event nav tabs (AI tab for admin/lead only)

### 6. Task View Tabs

**`pages/[slug]/tasks.jsx`** — filter bar replaced by tab navigation
- Tab pills below page title; active tab = blue bottom border
- Tabs:
  - **全部任務** (admin/lead only, default for admin/lead) — activity + status dropdowns, 4 status sections
  - **我的任務（按狀態）** (all roles, default for member) — my tasks in 4 status sections (shows empty state per section)
  - **我的任務（按活動）** (all roles) — my tasks grouped by activity name with icon
- "+ 新增任務" button (admin/lead only) visible on all tabs
- Deep link `?id=` highlight preserved across all tabs

### 7. Task Type Field

**Schema:** `tasks.task_type text DEFAULT 'general'`; `task_types` table (event-scoped, admin-managed)

**API routes:**
- `GET /api/task-types?event_id=` — returns types; auto-seeds 4 defaults (一般/採購/聯絡溝通/現場工作) on first call
- `POST /api/task-types?event_id=` — admin only, adds custom type
- `DELETE /api/task-types/[id]` — admin only, cannot delete default types

**`components/TaskForm.jsx`** — 任務類型 select (after description, before activity); fetches types per event; stores type name in `tasks.task_type`

**`components/TaskItem.jsx`** — shows task_type as small gray badge beside activity name (hidden if 'general')

**`components/TaskDetail.jsx`** — 任務類型 shown in task info meta row

**`pages/[slug]/admin/users.jsx`** — new "任務類型管理" section at bottom of page:
- Lists all types for event; defaults marked "預設"
- "+ 新增類型" inline form; delete button for custom types

**`prisma/schema.prisma`** — added `task_type String @default("general")` to Task model; new TaskType model; updated Announcement model with activity_id/reporter_id/reported_at

---

## Day 5 Patches

### Member Row Click-to-Edit (`fa9daed4`)
- `pages/[slug]/admin/users.jsx` — entire active member row is now clickable to open edit modal
- Trash button uses `e.stopPropagation()` so it doesn't also trigger the edit modal
- Pencil icon removed (row itself is the click target)

### Status Update Form Defaults to Selected Activity (`8b0db9c7`)
- `components/StatusUpdateForm.jsx` — accepts `defaultActivityId` prop
- `pages/[slug]/activities.jsx` — passes `selectedActivityId` as `defaultActivityId`
- When an activity card is selected (blue ring) before clicking "+ 新增狀態更新", the modal pre-selects that activity in the 相關活動 dropdown

---

## What Was Built — Day 6

### Per-Member Language Preference (EN / ZH)

**System default remains `zh` (Traditional Chinese). All existing behavior preserved.**

#### Schema

`users.preferred_lang` column (`text NOT NULL DEFAULT 'zh'`) was already present in the DB. No new migration required.

#### Architecture

Language preference uses a **React context pattern**, not prop drilling:

- Pages read `session.user.preferred_lang` and wrap their return in `<LangProvider lang={lang}>`
- All components call `useLang()` to read lang from context — no `lang` prop needed
- `Layout.jsx` is inside the provider and also uses `useLang()` internally
- The toggle in the Layout avatar dropdown calls `PUT /api/users/[id]` with `{ preferred_lang }`, then `router.reload()` — the reload fetches a fresh session from DB so the change is immediate

#### New Files

**`lib/lang.js`**
- `export const t = (lang, en, zh) => lang === 'en' ? en : zh` — core translation helper
- `export const UI` — object of shared string functions (`UI.statusOpen(lang)`, `UI.navDashboard(lang)`, etc.)
- `export const LANGS = { ZH: 'zh', EN: 'en' }`

**`context/LangContext.jsx`**
- `LangContext` — React context, default value `'zh'`
- `useLang()` — hook that reads from context; used by all components
- `LangProvider` — `<LangContext.Provider value={lang}>` wrapper used by all pages

#### Files Deleted

- `lib/useLang.js` — old stateful hook reading `session.user.lang`; replaced by `useLang()` from context
- `pages/api/users/me/lang.js` — old self-service endpoint writing to `lang` column; replaced by `PUT /api/users/[id]`

#### Infrastructure Changes

**`lib/auth.js`** — session callback selects `id, preferred_lang` from users:
- `session.user.preferred_lang = dbUser.preferred_lang ?? 'zh'`
- Always fresh from DB on every session check (not cached in JWT)

**`pages/api/users/[id].js`** — PUT now handles `preferred_lang`:
- Any authenticated user can update their own `preferred_lang` (self-or-admin gate)
- Logs the change to `activity_log`

**`components/Layout.jsx`** — uses `useLang()` internally; no `lang` prop
- Avatar dropdown language row: shows current language (`English` or `中文`) with `⇄` swap indicator
- Clicking calls `handleLangToggle()` → `PUT /api/users/${user.id}` → `router.reload()`
- Nav labels and bottom tab bar labels all bilingual via `t(lang, ...)`

#### Components Migrated to `useLang()` Context

All components removed their `lang = 'zh'` prop and call `useLang()` internally:

| Component | Notes |
|---|---|
| `StatusBadge` | Status labels bilingual |
| `TaskItem` | Date locale `en-US` / `zh-TW`; edit tooltip bilingual |
| `ConfirmDialog` | Cancel / delete labels bilingual |
| `TaskDetail` | All labels, history descriptions, relative time bilingual |
| `TaskForm` | All form labels bilingual |
| `ActivityCard` | Progress text, edit/delete bilingual |
| `ActivityForm` | All form labels bilingual |
| `StatusUpdateForm` | All form labels bilingual |
| `InviteForm` | All form labels + role labels bilingual |
| `AISummary` | UI text bilingual; TTS lang switches to `en-US`; time-range labels bilingual |
| `AIChat` | UI text bilingual; voice input lang switches to `en-US` |

#### Pages Updated

Each page wraps its return in `<LangProvider lang={lang}>` where `lang = session?.user?.preferred_lang ?? 'zh'`. No `lang` prop is passed to Layout or any migrated component.

- `pages/[slug]/dashboard.jsx`
- `pages/[slug]/activities.jsx`
- `pages/[slug]/tasks.jsx` — internal `Section` component also uses `useLang()`
- `pages/[slug]/admin/users.jsx`
- `pages/[slug]/ai.jsx`

#### AI APIs

Both API routes now derive lang exclusively from the authenticated session — the client no longer sends a lang parameter:

**`pages/api/ai/summary.js`** — `const lang = session.user?.preferred_lang ?? 'zh'`
- English prompt → English summary; Chinese prompt → Chinese summary

**`pages/api/ai/chat.js`** — `const lang = session.user?.preferred_lang ?? 'zh'`
- Bilingual system prompt; bilingual fallback error messages

#### Email System

**`lib/email.js`** — each send function now accepts explicit `lang` parameter:
- `sendDailyDigest(user, tasks, slug, eventId, lang)` — subject: `t(lang, 'Your Daily Task Summary', '今日任務摘要')`
- `sendLeadDigest(user, activity, tasks, slug, eventId, lang)` — subject: `t(lang, 'Activity Summary', '活動摘要')`
- `sendOverdueReminder(user, tasks, slug, eventId, lang)` — subject: `t(lang, '⚠️ Overdue Tasks', '⚠️ 逾期任務提醒')`
- `import { t } from '@/lib/lang'` added; no longer reads `user.lang` internally

**`pages/api/cron/daily-digest.js`** — users query now selects `preferred_lang`; passes `user.preferred_lang ?? 'zh'` to each send function

**`emails/DailyDigest.jsx`**, **`emails/LeadDigest.jsx`**, **`emails/OverdueReminder.jsx`** — converted from `isEn ? ... : ...` ternaries to `t(lang, en, zh)` calls; `import { t } from '@/lib/lang'` added

---

---

## Neon Database Migration (Stages 1–3a) — July 2026

### Stage 1 — Schema Push to Neon

- Added `prisma` and `@prisma/client` (v5.22.0) as devDependencies for schema management
- Added `preferred_lang String @default("zh")` to User model in `prisma/schema.prisma` (was in Supabase but missing from schema reference)
- Ran `prisma db push` against Neon direct connection (PostgreSQL 17.10)
- All 9 tables created on Neon: `events`, `users`, `event_members`, `activities`, `tasks`, `task_types`, `announcements`, `email_log`, `activity_log`
- Full schema diff confirmed: `uuid_generate_v4()` → `gen_random_uuid()` (functionally identical), `now()` → `CURRENT_TIMESTAMP` (identical), 4 nullable-to-NOT-NULL tightening (no NULL data found in pre-flight check)
- Stale `users.lang` column identified in Supabase (dead column, replaced by `preferred_lang` in Day 6) — intentionally excluded from Neon

### Stage 2 — Data Migration

- Custom Node.js migrator (using `pg` package) reading from Supabase session-mode pooler, writing to Neon direct URL
- Insert order: `events → users → event_members → activities → task_types → email_log → activity_log → announcements → tasks` (FK-safe)
- `users.lang` (Supabase-only stale column) filtered out by reading Neon's column list before SELECT
- All 9 tables: exact row-count match (75 total rows)
- FK spot-check on 3 random tasks: all `activity_id`, `assignee_1_id`, `created_by` references resolved
- `preferred_lang` distribution: `en=1, zh=5` — copied correctly (not defaulted)
- SQL dump written to `migration/data-dump-supabase.sql` (gitignored — contains user data)

### Stage 3a — lib/ Layer Migrated to Neon

**`pg` moved from devDependencies → dependencies** (required for Vercel production runtime)

**`lib/db.js`** (new) — singleton `pg.Pool` using `DATABASE_URL` (Neon pooled connection string):
- `globalThis.__pgPool` singleton prevents multiple pool instances during Next.js hot-reload
- Exports `query(text, params)` helper and the pool itself
- SSL: `rejectUnauthorized: false` (Neon hosted TLS)
- Pool: max 10 connections, 30s idle timeout, 10s connection timeout

**`lib/auth.js`** — Supabase client removed; replaced with raw pg queries via `lib/db.js`:
- `signIn`: `INSERT INTO users ... ON CONFLICT (email) DO UPDATE SET name, avatar_url` — `preferred_lang` is never overwritten on sign-in (DB column default `'zh'` applies only on first insert)
- `session`: `SELECT id, preferred_lang FROM users WHERE email = $1` + `SELECT role FROM event_members WHERE user_id = $1` — identical shape to previous Supabase queries

**`lib/email.js`** — Supabase client removed; `logEmail()` now calls `INSERT INTO email_log ... VALUES ($1,$2,$3,$4)` via `lib/db.js`

**Remaining Supabase surface (Stage 3b):** `lib/supabase/server.js` and 13 API route files that call `createServerClient()` + 2 API routes with direct `createClient()` calls — all still pointing at Supabase until Stage 3b rewrites each route to raw SQL.

---

## Current State

- Per-user language preference: `zh` (Traditional Chinese, default) or `en` (English)
- Language toggle in avatar dropdown — shows current language with `⇄` indicator; persists to DB on click, page reloads with new language
- Full Traditional Chinese UI across all pages and components (unchanged for zh users)
- Full English UI for `en` users: all pages, components, AI responses, email subjects and body
- AI summary and chat respond in the session user's `preferred_lang`
- Email digests and overdue reminders sent in each recipient's `preferred_lang`
- Three-tier task permission model: admin/lead → assignee → creator
- Task description + title inline editing
- AI 助理 page (separate from dashboard) — admin/lead only
- Voice input in AI Chat (zh-TW or en-US per lang)
- Status updates: modal form with activity/reporter/time fields; clickable activity filter
- Nav: home icon (left) + centered links + avatar (right); AI tab for admin/lead only
- Task tabs: 全部任務 / 我的任務（按狀態）/ 我的任務（按活動）
- Task types: event-scoped admin-managed list; badge on TaskItem; field in TaskForm/TaskDetail
- Mobile: bottom tab bar with HOME + event nav tabs

---

## Pending / Next Steps

- **Local testing:** `npm run dev` → verify language toggle, all pages in EN + ZH, email send
- **`ANTHROPIC_API_KEY`** must be set in `.env.local` and Vercel env vars
- **`CRON_SECRET`** must be set in Vercel environment variables
- Production push to Vercel when local testing passes
- Trigger announcement emails from Activities page (currently only posted to DB)
- Consider per-event role context (currently uses highest role across all events)
