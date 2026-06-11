# BT-Member Event Management — Progress Snapshot

## Day 1 Complete — Foundation, Auth, Home, Activities, Dashboard

### What Was Built

**Project Setup**
- Next.js 14 (pages router), Tailwind CSS, ESLint
- Dependencies: `next-auth`, `@auth/supabase-adapter`, `@supabase/supabase-js`, `resend`
- `.env.local.example` with all required keys
- `next.config.js`, `tailwind.config.js`, `postcss.config.js`
- Tabler Icons loaded via CDN in `globals.css`

**Supabase**
- `supabase/schema.sql` — 7 tables with RLS:
  - `events`, `users`, `event_members`, `activities`, `tasks`, `announcements`, `email_log`
- `supabase/seed.sql` — seed event: BT Annual Event 2026 (slug: 2026-annual-event)

**Lib Files**
- `lib/supabase/server.js` — server-side Supabase client
- `lib/supabase/client.js` — browser Supabase singleton
- `lib/auth.js` — NextAuth config (Google provider, upserts user on sign-in, role from event_members)
- `lib/constants.js` — ICONS (10), STATUS_LIST, ROLES

**API Routes**
- `GET/POST /api/events`
- `GET/POST /api/activities?slug=` and `PUT/DELETE /api/activities/[id]`
- `GET/POST /api/announcements?event_id=`
- `GET /api/tasks?slug=`
- `GET /api/users?event_id=`
- `pages/api/auth/[...nextauth].js`

**Components**
- `Layout.jsx` — nav bar with event name, page links, user avatar, admin-only Users link
- `ActivityCard.jsx` — icon, lead/co-lead, progress bar, edit/delete (admin)
- `ActivityForm.jsx` — modal create/edit with IconPicker, lead/co-lead selects
- `IconPicker.jsx` — dropdown of 10 Tabler icons
- `Avatar.jsx` — initials circle or Google photo
- `StatusBadge.jsx` — open/in_progress/done/overdue with color coding

**Pages**
- `/` — Module home: event grid, active event highlighted, admin Add Event button
- `/[slug]` — Event login: Google sign-in, redirect to dashboard if already authed
- `/[slug]/dashboard` — Stats row, My Tasks, Activity Progress with progress bars
- `/[slug]/activities` — Activity grid + Announcements section with admin post form
- `/[slug]/tasks` — Full task list for event

### Next Steps (Day 2)
- Task create/edit modal and full task management
- Users page (admin: manage members, assign roles)
- Email digest via Resend (daily + overdue reminders)
- Polish: loading states, error boundaries, empty states
