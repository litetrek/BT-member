# BT-Member Event Management — Progress Snapshot

## Lantern Inventory — Stage 3 Patch (Zoomable Photo Lightbox)

Requested after trying Stage 3 on-device: clicking a photo should show it big and
zoomable, not just as a small thumbnail.

**`components/InventoryPhotoLightbox.jsx`** (new) — full-screen overlay, tap the image
to toggle a 200% zoom (scrollable container); native iOS pinch-zoom also still works
since nothing disables viewport scaling. Tap the backdrop or × to close; prev/next
arrows appear when there's more than one photo. No new dependency — plain component.

Wired in two places where photos are purely informational (not already a navigation
click target):
- **Lantern detail page** (`[tagId].jsx`) — the photo gallery thumbnails now open the
  lightbox at the tapped photo's index, cycling through all of that lantern's photos.
  The existing "設為主要"/"刪除" buttons below each thumbnail are untouched.
- **Location detail page** (`locations/[code].jsx`) — the single hero photo opens the
  lightbox.

Deliberately **not** added to the location-list and lantern-list thumbnails, or the
Field mode lantern cards — those thumbnails are navigation/selection targets (clicking
them already does something: go to detail, or open Quick Inspect), so overloading them
with a lightbox would conflict with their existing purpose.

**Verified**: `npm run build` passes clean; dev server confirms both pages still 200.

---

## Lantern Inventory — Stage 3 Complete (Field Mode)

Fourth of six staged builds. Delivers the on-site iPhone walkthrough: location-first
flow, Quick Inspect, photo-first new-lantern capture, auto-move, progress counter, local
draft resilience, and a scoped home-screen manifest.

**Schema**: added `inv_lantern_locations.last_walkthrough_at` (nullable timestamptz) —
backs the "Mark Location Done" button.

**API routes**
- `POST /api/inventory/inspections` — the core of Stage 3: inserts an
  `inv_lantern_inspections` row, then updates the lantern's `condition`,
  `cloth_damage_pct`/`frame_damage_pct`, recomputed `displayable`, and `location_id` —
  all from one call, matching the spec's "saving an inspection updates the lantern's
  current condition, damage %, and location" requirement. If the submitted `location_id`
  differs from the lantern's prior one, a second `inv_lantern_activity_log` entry
  (`action: 'moved'`) is written with the old/new location codes — this *is* the
  auto-move behavior; Field mode never shows a location picker, it just always submits
  wherever the recorder currently is.
- `POST /api/inventory/locations/[code]/walkthrough` — sets `last_walkthrough_at = now()`
  (editor+), logs a `walkthrough_done` entry.
- `GET /api/inventory/lanterns/[tagId]` — now also returns `inspections` (joined to
  location code, newest first) for the detail page's history timeline.

**`lib/inventoryFieldDraft.js`** (new, browser-only) — the "nothing lost if signal
drops mid-form" requirement: `saveDraft`/`loadDraft`/`clearDraft` persist in-progress
Quick Inspect / New Lantern form state to `localStorage`, all wrapped in `try/catch`
(private browsing can throw) so a failed draft write never crashes the page. Also backs
the progress counter: `getCheckedIds`/`markChecked`/`clearChecked` track which lantern
ids have been handled at a given location this walkthrough, surviving a reload —
intentionally scoped to Field mode's forms, not retrofitted onto Stage 1/2's forms.

**`components/InventoryQuickInspectSheet.jsx`** (new) — bottom sheet: four big condition
buttons (Good/OK/Fair/Bad), cloth/frame damage sliders (step 5%), notes, multi-photo
attach. Used two ways: from Field mode with `fixedLocationId`/`locationCode` set (no
location picker — this is what makes auto-move automatic), and from the lantern detail
page's new "記錄檢查 Record Inspection" button with no fixed location (shows a location
select, defaults to the lantern's current one, for recording an inspection outside a
walkthrough). Every field change writes a draft immediately.

**`components/InventoryFieldNewLanternSheet.jsx`** (new) — the spec's photo-first flow
as three steps: (1) take/attach a photo — required before continuing, (2) the rest of
the fields (name, category, QTY, voltage, power, dimensions, condition, damage %) with
location implicit from the current field location, (3) the newly auto-assigned tag ID
shown at `text-5xl` with "write this on a temporary label now" — satisfies the spec's
"Tag ID is auto-assigned and shown large" requirement directly.

**Pages**
- `pages/inventory/lanterns/field/index.jsx` — location picker, same zone-grouped grid
  pattern as the Locations list but condensed to code + lantern count, bigger touch
  targets; editor+ only (viewers redirected to the lantern list — field mode is a
  write-only workflow)
- `pages/inventory/lanterns/field/[code].jsx` — the walkthrough screen: progress line
  ("已檢查 X / Y"), last-walkthrough timestamp if any, sticky "+ 新增燈籠" button, lantern
  card grid with a green check overlay once handled this session, sticky bottom "標記此
  地點已完成" bar. Tapping a lantern card opens Quick Inspect with the location locked;
  tapping "+ 新增燈籠" opens the photo-first new-lantern sheet.
- `pages/inventory/lanterns/[tagId].jsx` — added the "記錄檢查" button (opens the same
  Quick Inspect sheet, unlocked location) and an "檢查歷史 Inspection History" timeline
  section above the existing activity log.

**Home-screen manifest** — `public/inventory-field-manifest.json`, scoped to
`/inventory/lanterns/field` only (not the whole app). Icons
(`public/icons/lantern-{180,192,512}.png`) are hand-built solid-color placeholder PNGs
generated by `scripts/generate-inventory-icons.js` (pure Node `zlib`, no image library) —
**explicitly a placeholder**, swap for real branding when available. `<link rel="manifest">`
+ `apple-touch-icon` + `theme-color` added to both field pages' `<Head>`.

**Scope decisions**: no separate standalone "Move" button on the detail page — recording
an inspection with a different location already covers it (spec lists "Move" as a
separate button, but the mechanism is identical to what Quick Inspect already does, so a
second button would just be a second entry point to the same code path). QR
scan-to-open (Stage 5) obviously isn't built yet — "scan its tag" in the spec's flow is
explicitly marked Stage 5.

**Verified**: `npm run build` passes clean, including the new nested dynamic route
`/api/inventory/locations/[code]/walkthrough` coexisting with the sibling `[code].js`
detail route. Direct DB-level test (mirroring the exact `POST /api/inventory/inspections`
logic): created a test lantern at location B4, submitted an "inspection" at B5 with 40%
cloth damage — confirmed the lantern's `condition`, `displayable` (correctly flipped to
`false`), and `location_id` (moved to B5) all updated from one call; test rows deleted
after. Dev server confirms both field pages 200, both new API routes 403 unauthenticated,
and the manifest + icon both serve 200. Generated PNG icon verified to load correctly via
.NET's `System.Drawing.Image.FromFile`. **Not yet verified**: the actual on-site
experience — walking a real location, Quick Inspect timing (spec's "under ~1 minute
each" target), draft survival through an actual dropped connection, and the Home Screen
add flow on an iPhone. All need Vincent.

---

## Lantern Inventory — Stage 2 Patch (Readability + Photo Input Fixes)

Three fixes requested after trying Stage 2 on-device, applied across the whole Inventory
Control module (`pages/inventory/**`, `components/Inventory*.jsx`) — not the rest of the
app, which already has its own separate font conventions:

1. **Bigger fonts** — every `text-xs` → `text-sm`, `text-sm` → `text-base`, `text-lg` →
   `text-xl`, and the small `text-[10px]` badges → `text-xs`, done as three ordered
   blanket passes per file (sm→base, then xs→sm, then [10px]→xs) so sizes don't cascade
   on top of each other.
2. **Photo input was camera-only** — every file input across the module had
   `capture="environment"`, which on iOS Safari skips the normal action sheet and opens
   the rear camera directly, so there was no way to attach an existing photo from the
   library. Removed `capture="environment"` from all three photo inputs
   (`InventoryLocationForm`, `InventoryLanternForm`, the lantern detail page's inline
   add-photo button) — iOS now shows its native "Take Photo / Photo Library / Browse"
   sheet instead.
3. **Lantern detail page's inline "+ 新增照片" was single-file only** — the create/edit
   form (`InventoryLanternForm`) already supported multiple photos per lantern, but the
   detail page's quick-add uploader only took one file at a time. `handleAddPhoto()` in
   `pages/inventory/lanterns/[tagId].jsx` now accepts `multiple` and loops through every
   selected file, uploading and inserting a photo row for each (first one becomes primary
   only if none exists yet) — matches the spec's "field worker can take photo to present
   condition" use case directly from the detail page, not just when creating a lantern.

**Verified**: `npm run build` passes clean; dev server confirms `/inventory/lanterns`,
`/inventory/lanterns/new`, `/inventory/lanterns/locations` all still 200 after the
blanket class-name edits (no broken JSX from the find/replace passes). Visual sizing and
the iOS action-sheet behavior itself need Vincent's on-device check, same as prior stages.

---

## Lantern Inventory — Stage 2 Complete (Core Lantern Records)

Third of six staged builds. Delivers full lantern CRUD, photo gallery, search/filters,
and activity logging per the spec's Stage 2 scope.

**Route restructure**: `/inventory/lanterns` is now the real lantern list (per the spec's
screens table), replacing the Stage 0/1 "screen menu" placeholder. Navigation between
Lanterns / Locations / Field (disabled) / Admin (disabled) moved into a shared tab strip,
**`components/InventoryLanternNav.jsx`**, used on both the lantern list and Locations
pages. The Stage 0 photo-upload test widget was removed — the real lantern form now
exercises that same upload path.

**Schema**: no new tables. `inv_lantern_lanterns.tag_id` default (from Stage 0) assigns
`LT-0001`, `LT-0002`, … automatically on insert — never passed by the client.

**`lib/db.js`** — added `insertInventoryLog()` (already landed in Stage 1) is now used by
the lantern routes too.

**API routes**
- `GET/POST /api/inventory/lanterns` — list with dynamic filters (`q` searches tag_id +
  both name fields via `ILIKE`; `category_id`, `location_id`, `voltage`, `condition`,
  `status`, `display_decision`, `displayable`) and joins in category name, location code,
  and primary photo thumbnail / create (editor+, computes `displayable` server-side via
  `computeDisplayable()` — never trusts a client-sent value)
- `GET/PUT/DELETE /api/inventory/lanterns/[tagId]` — detail (includes photos ordered
  primary-first, and the last 20 `inv_lantern_activity_log` entries for that record) /
  update (editor+, recomputes `displayable` from whatever damage % was submitted) / delete
  (admin only — also removes the lantern's photo rows, though the underlying Blob files
  are left orphaned; out of scope per the spec's own "out of scope" list)
- `GET /api/inventory/categories` — list (viewer+), feeds the category select/filter
- `POST /api/inventory/photos` — generic photo-metadata row creator (editor+) used by both
  the create/edit form and the detail page's inline "+ 新增照片"; flips any existing
  primary photo off first when a new one is marked primary
- `PUT/DELETE /api/inventory/photos/[id]` — set-as-primary / remove a single photo (editor+)

**`components/InventoryLanternForm.jsx`** (new) — the big one: name (zh/en), category,
qty, voltage, power, height/width/depth (ft), location, condition, cloth/frame damage %,
notes, multi-file photo picker. On create: POSTs the lantern first to get its id/tag_id,
then uploads each selected photo (Stage 0's `uploadInventoryPhoto()`) and POSTs a photo
row per file, first one marked primary. Shared between `/inventory/lanterns/new` and
`/inventory/lanterns/[tagId]/edit`.

**Pages**
- `pages/inventory/lanterns/index.jsx` — now the lantern list: summary bar (total
  records, total QTY, count per condition — reflects the *currently filtered* set, not
  the whole inventory), search + 7 filter dropdowns, card grid with thumbnail/tag/name/
  condition/location, red "不可展示" badge when `displayable = false`
- `pages/inventory/lanterns/new.jsx`, `pages/inventory/lanterns/[tagId]/edit.jsx` —
  wrap `InventoryLanternForm`; gated to editor+ (viewers can't create/edit)
- `pages/inventory/lanterns/[tagId].jsx` — full field display, red "不可展示" banner,
  photo gallery (set-primary / delete per photo, inline add-photo for editor+), activity
  log, admin-only delete (with `ConfirmDialog`)
- `pages/inventory/lanterns/locations/[code].jsx` — lantern cards now link to their
  detail page (were static/non-clickable before Stage 2 existed)

**Verified**: `npm run build` passes clean, including confirming
`[tagId].jsx` and `[tagId]/edit.jsx` coexist as separate routes with no conflict. Direct
DB-level test (bypassing the API, hitting Neon the same way the route code does):
inserting a lantern with 35% frame damage via the exact same `computeDisplayable()` logic
correctly stored `displayable = false`, auto-assigned `tag_id = LT-0001`, and the
`displayable`/`location_id` filter queries both returned it correctly — test row deleted
after. Dev server confirms all new pages 200 and all new API routes 403 when
unauthenticated. **Not yet verified**: the full create → photo upload → filter flow
through an actual signed-in browser session — needs Vincent, same as prior stages.

---

## Lantern Inventory — Stage 1 Complete (Locations)

Second of six staged builds. Delivers the Locations screens per the spec's Stage 1
scope: zone-grouped list, location detail, admin add/edit with photo.

**Schema tweak** (before building, via `prisma db push` again): added
`inv_lantern_locations.photo_thumb_url` (list view needed a small image, not the full
1600px one); changed `created_by`/`updated_by`/`uploaded_by` across `InventoryLocation`,
`InventoryLantern`, `InventoryPhoto` from `uuid` to plain text (user email from session)
— decouples the module from needing a `users.id` lookup, consistent with how
`inv_lantern_inspections.inspected_by` was already speced as email text.

**`lib/db.js`** — added `insertInventoryLog(entry)`, writing to
`inv_lantern_activity_log` (table_name, record_id, record_name, action, field_changed,
old_value, new_value, user_email) — the Inventory module's own audit log, separate from
the event-scoped `activity_log`/`insertLog()`.

**`lib/auth.js`** — `requireInventoryRole()` now also stamps `req.inventoryEmail` with
the session email, so route handlers can attribute `created_by`/log entries without a
second session lookup.

**API routes** (all gated via `requireInventoryRole`)
- `GET/POST /api/inventory/locations` — list (viewer+, includes `lantern_count` via a
  `LEFT JOIN` aggregate against `inv_lantern_lanterns`, ordered by `sort_order`) / create
  (admin, auto-assigns next `sort_order`)
- `GET/PUT /api/inventory/locations/[code]` — detail (viewer+, includes every lantern
  currently at that location — empty for now, no lanterns exist until Stage 2) / update
  (admin; `photo_url`/`photo_thumb_url` only overwritten when a new photo was uploaded,
  via `COALESCE`)

**`components/InventoryLocationForm.jsx`** (new) — admin-only add/edit modal: code
(locked on edit), zone select, description, photo file input. On create: POSTs the
location first to get an id, then (if a photo was picked) uploads via
`uploadInventoryPhoto()` from Stage 0 and PUTs the resulting URLs onto the new record —
one Save click, two requests under the hood.

**Pages**
- `pages/inventory/lanterns/locations/index.jsx` — cards grouped by zone in the order
  the spec's screen description uses (A, B, C, D, E, Cabin — note this differs from the
  seed's physical `sort_order` sequence, which has Cabin between D6 and E1; grouping
  order and seed order answer different questions and don't need to match), each
  showing thumbnail, code, description, lantern count; admin-only "+ 新增地點" button
- `pages/inventory/lanterns/locations/[code].jsx` — full photo, description, list of
  lanterns stored there (empty state until Stage 2), admin-only edit button
- `pages/inventory/lanterns/index.jsx` — "under construction" placeholder replaced with
  a 4-card screen menu (Locations live; Lantern List / Field Mode / Admin marked 即將推出
  until their stages ship); Stage 0's photo-upload test widget kept underneath for now

**Verified**: `npm run build` passes clean; direct SQL check confirms all 40 locations
present with correct `sort_order` (A2 before A10, D6 → Cabin → E1); dev server serves
`/inventory/lanterns`, `/inventory/lanterns/locations`, `/inventory/lanterns/locations/A1`
all 200; `/api/inventory/locations` correctly 403s when unauthenticated. **Not yet
verified**: the add/edit flow and photo attach through an actual signed-in browser
session (needs Vincent, since Google OAuth sign-in can't be automated from here).

---

## Lantern Inventory — Stage 0 Complete (Foundation)

First of six staged builds per the "BT Lantern Inventory Control — Spec & Build Plan" doc
(Vincent's claude.ai spec). Stage 0 = schema + roles + photo upload plumbing only — no
lantern CRUD UI yet (that's Stage 2). Two deviations from the spec, both required since
the spec was written without knowledge of this repo's current state:
- **Database**: spec said Supabase Postgres + Supabase Storage. This app fully decommissioned
  Supabase in July 2026 (see Neon Migration section below) — built against **Neon** instead,
  consistent with the rest of the app.
- **Photo storage**: Supabase Storage doesn't exist here anymore. Used **Vercel Blob**
  (`access: 'public'`, random-suffixed paths) per Vincent's choice — note this means photos
  are *not* behind true private signed URLs like the spec originally called for; acceptable
  since lantern condition photos aren't sensitive.
- Framework note (not a deviation, just confirmed): built in the **Pages Router** to match
  the rest of the app; the spec's mention of "App Router" was generic, not a hard requirement.

**Database — 6 new tables on Neon, prefixed `inv_lantern_`** (via `prisma/schema.prisma` +
`npx prisma db push`, schema-management-only per existing convention — no Prisma Client at runtime):
- `inv_lantern_categories`, `inv_lantern_locations`, `inv_lantern_photos`,
  `inv_lantern_lanterns`, `inv_lantern_inspections`, `inv_lantern_activity_log`
- `inv_lantern_tag_seq` — Postgres sequence backing `tag_id` (`LT-0001`, `LT-0002`, …),
  created via `scripts/migrate-inventory-lanterns-presetup.js` (must run before `db push`,
  since `db push` won't create bare sequences)
- `scripts/prisma-push-neon.js` — wrapper that loads `DATABASE_URL` from `.env.local` and
  spawns `prisma db push` with it injected (Prisma CLI only auto-reads `.env`, not `.env.local`)
- `displayable` is computed in app code (not a DB-generated column) via
  `lib/inventoryConstants.js`'s `computeDisplayable()` — false when cloth OR frame damage
  ≥ `NOT_DISPLAYABLE_DAMAGE_PCT` (30, one config constant)
- Seeded via `scripts/seed-inventory-lanterns.js` (idempotent): 4 categories (海洋/Ocean,
  天界/Heaven, 森林/Forest, 蓮花園/Lotus Garden) + 40 locations (A1–A10, B1–B10, C1–C10,
  D1–D6, Cabin, E1–E3) with `sort_order` so A2 sorts before A10

**Roles — `lib/inventory.js` restructured from a plain allowlist to `{ email: role }`**
- `INVENTORY_ACCESS` now maps each email directly to a role: `admin` (vlin77@gmail.com),
  `editor` (joannazhao168@gmail.com, weiyanoble@gmail.com, qqandcici@gmail.com, pai8788@gmail.com).
  Third role `viewer` defined but unassigned (management team, not yet named — open question
  from the spec).
  `INVENTORY_ROLE_PRIORITY` ranks `admin > editor > viewer` for `hasInventoryRole()` checks.
- Stayed client-safe (no server-only imports) — it's imported by `pages/index.jsx` and the
  inventory pages for client-side role checks.
- **`lib/auth.js`** — added `requireInventoryRole(req, res, minRole)`, the API-route gate
  (mirrors the existing `requireAdmin` pattern): 403s and returns `null` if the session
  email's role doesn't meet `minRole`, else returns the role string.

**Photo upload plumbing**
- `lib/inventoryPhoto.js` (browser-only) — `resizeForUpload(file)` canvas-resizes to a
  full version (~1600px long edge, JPEG q0.8) and thumbnail (~400px, q0.75); handles HEIC
  input since iOS Safari decodes it natively for canvas. `uploadInventoryPhoto(file, ownerType,
  ownerId)` resizes then POSTs both to the upload route, returns `{ url, thumbUrl }`.
- `pages/api/inventory/photos/upload.js` — `requireInventoryRole(…, 'editor')` gated; body
  parsing disabled so the raw request stream pipes straight to Blob storage (no base64
  overhead); query params `ownerType`/`ownerId`/`kind` (`full`|`thumb`) build the Blob path.
- `lib/blob.js` — thin wrapper around `@vercel/blob`'s `put()`.
- **Stage 0 verification harness**: `pages/inventory/lanterns/index.jsx` temporarily carries
  a "Stage 0 — 照片上傳測試" file-picker widget (uses `capture="environment"` so iPhone Safari
  opens the rear camera) that exercises the full resize→upload→display round trip. To be
  removed once Stage 2 ships the real lantern form.

**Verified**: `npm run build` passes clean; dev server serves `/`, `/inventory`,
`/inventory/lanterns` all 200 with no runtime errors; all 6 tables + sequence confirmed
present on Neon; seed confirmed 4 categories + 40 locations inserted. `BLOB_READ_WRITE_TOKEN`
is set up and Vincent confirmed the Stage 0 photo-upload test widget works end to end
(resize → Vercel Blob upload → display). Stage 0 "done when" criteria are met — ready for
Stage 1 (Locations).

---

## Inventory Control Module — Top-Level Scaffold

A new, event-independent top-level module for inventory tracking, separate from the
Events system. Access is gated by a Gmail allowlist (not `event_members` roles), since
inventory users are not necessarily event participants.

**`lib/inventory.js`** (original scaffold; see Stage 0 above for the roles rework)
- `INVENTORY_ACCESS` — hardcoded allowlist, two tiers:
  - `admin`: `vlin77@gmail.com`
  - `editor`: `joannazhao168@gmail.com`, `weiyanoble@gmail.com`, `qqandcici@gmail.com`, `pai8788@gmail.com`
- `getInventoryRole(email)` — returns `'admin'`, `'editor'`, or `null`
- `INVENTORY_MODULES` — array of inventory subsystems shown on the hub page; currently just Lantern Inventory. Add new entries here as future subsystems are built.

**`pages/inventory/index.jsx`** (new) — Inventory Control hub
- Google sign-in gate (same pattern as event login page) if unauthenticated
- Redirects to `/` if authenticated but email not in `INVENTORY_ACCESS`
- Header shows role badge (管理員/編輯者) + avatar; back-to-home link
- Grid of subsystem cards from `INVENTORY_MODULES` (currently one: 燈籠庫存 → `/inventory/lanterns`)

**`pages/inventory/lanterns/index.jsx`** (new) — Lantern Inventory
- Same access gate as hub (redirects to `/inventory` if unauthenticated, `/` if unauthorized)
- Placeholder "功能開發中，敬請期待" — no inventory functionality built yet; menu/routing scaffold only, per explicit scope for this stage

**`pages/index.jsx`** — homepage
- New "庫存管理" section rendered below the Events grid, visible only when `getInventoryRole(session.user.email)` is non-null
- Card links to `/inventory`; fully hidden for unauthenticated users and non-allowlisted accounts

**Design notes**
- Inventory pages do not use the existing `Layout.jsx` component (that component is event-scoped, keyed by event `slug`) — they use a lightweight standalone header matching the homepage's visual style
- Not wired into the `LangContext` bilingual system yet — Traditional Chinese only, matching homepage defaults; can be added when the Lantern Inventory feature itself is built
- Access list is hardcoded in `lib/inventory.js` rather than DB-backed, consistent with other static config in `lib/constants.js` (`ROLES`, `ICONS`); revisit if the list needs to be editable without a redeploy

---

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

### Stage 3a Addendum — Post-Deploy Sign-In Verified

- Production deployment at `https://bt.cyber-tech.com` (Vercel, commit `0e995fd0`)
- Sign-in at Jul 06 20:33:10 Pacific confirmed complete OAuth flow hitting Neon (no Supabase in logs)
- Neon row verified: `id=7f006f4d`, `name=Vincent Lin`, `email=vlin77@gmail.com`, `preferred_lang=zh`
- Schema gap flagged: `users` table has no `updated_at` column — addressed in Stage 3b with `last_signed_in_at`

### Stage 3b — All API Routes Migrated to Neon

**`lib/db.js`** — added `insertLog(entry)` export: single-row INSERT into `activity_log` with all 10 columns, null-coalesced. Used by 6 API route files.

**`prisma/schema.prisma`** — added `last_signed_in_at DateTime? @db.Timestamptz(6)` to User model; pushed to Neon.

**`lib/auth.js`** — `signIn()` upsert now sets `last_signed_in_at = NOW()` on both INSERT and ON CONFLICT UPDATE, providing an audit timestamp for every sign-in.

**All 15 API routes rewritten** from Supabase client to raw pg queries via `lib/db.js`:

| Route | Methods | Key SQL patterns |
|---|---|---|
| `events/index` | GET, POST | SELECT *, INSERT RETURNING * |
| `users/index` | GET | WHERE name IS NOT NULL; ANY($1) array param |
| `users/[id]` | PUT, DELETE | UPDATE users; UPDATE event_members; DELETE from event_members |
| `users/invite` | POST | SELECT by email; INSERT ON CONFLICT DO UPDATE for event_members |
| `task-types/index` | GET, POST | Auto-seed 4 defaults on empty; INSERT per type in loop |
| `task-types/[id]` | DELETE | Fetch name, guard DEFAULT_NAMES, DELETE |
| `activities/index` | GET, POST | Separate queries + in-JS join; insertLog on POST |
| `activities/[id]` | PUT, DELETE | Fetch for logging; UPDATE/DELETE RETURNING *; insertLog |
| `announcements/index` | GET, POST | 3-table LEFT JOIN with CASE WHEN json_build_object; insertLog |
| `log/index` | GET | Dynamic WHERE (event_id vs task_id + optional hours); LEFT JOIN actor |
| `tasks/index` | GET, POST | 3-table LEFT JOIN (activity, assignee1, assignee2) with CASE WHEN; multi-entry insertLog |
| `tasks/[id]` | PUT, DELETE | Fetch with activity JOIN; dynamic SET clause builder from update object; insertLog |
| `ai/summary` | GET | LEFT JOIN actor; json_build_object |
| `ai/chat` | POST | 3 parallel queries (tasks with assignee joins, log with actor, announcements) |
| `cron/daily-digest` | GET, POST | All queries via pg; sent_at >= $2::date dedup; WHERE name IS NOT NULL |

**Deleted:** `lib/supabase/server.js`, `lib/supabase/client.js`

**Removed from `package.json`:** `@supabase/supabase-js`, `@auth/supabase-adapter`

**Zero Supabase imports remain** anywhere in `pages/` or `lib/` — confirmed by grep.

**Build:** `npm run build` passes cleanly (0 errors, all 15 API routes compiled as dynamic routes).

### Post-3b Fixes (commit `b7f4988a`)

Two bugs discovered during verification, both pre-existing from original Supabase code:

**Lead-digest dedup fix:**
- `sendLeadDigest()` in `lib/email.js` was logging `type='daily_digest'` instead of `'lead_digest'`
- Cron dedup key was `${user.id}:lead:${activity.id}` — never matched the DB-seeded `alreadySent` set
- Fix: log `type='lead_digest'`; dedup key changed to `${user.id}:lead_digest`
- Result: second consecutive cron run now sends 0 lead digests (confirmed)

**CRON_SECRET local bypass fix:**
- `CRON_SECRET` was absent from `.env.local`, so `undefined !== undefined` silently passed the auth check
- Fix: added `CRON_SECRET=local-dev-placeholder` to `.env.local` and `.env.local.example`

### Migration Cleanup (this commit)

- Deleted `migration/data-dump-supabase.sql` from working tree (contained real user emails/UUIDs — SQL dump used during Stage 2 data migration; deferred git history purge is intentional)
- `.gitignore` entry changed from `migration/` (whole directory) to `migration/*.sql` with explanatory comment
- Confirmed: `lib/supabase/server.js` and `lib/supabase/client.js` already deleted in Stage 3b
- Confirmed: `@supabase/supabase-js` and `@auth/supabase-adapter` already removed from `package.json` in Stage 3b
- Final repo-wide grep: zero Supabase references remain in `pages/`, `lib/`, or `components/`

**Supabase is fully decommissioned as a runtime dependency.** The app connects exclusively to Neon (PostgreSQL 17) via `pg` pool. Supabase project `wlratdydeubyehtudeyt` may be deleted or allowed to lapse — no runtime path depends on it.

---

## Supabase → Neon Migration: Complete Summary

| Stage | What changed |
|---|---|
| **Schema** | `prisma db push` against Neon direct URL; `preferred_lang` schema drift corrected; `last_signed_in_at` added |
| **Data** | Custom Node.js migrator (no pg_dump on Windows); FK-safe insert order; 75 rows migrated exact-match |
| **Auth** | `lib/auth.js` rewritten from Supabase client to raw pg; `last_signed_in_at` now stamped on every sign-in |
| **lib/email.js** | `logEmail()` rewritten from Supabase insert to raw pg |
| **lib/db.js** | New singleton Pool + `query()` helper + `insertLog()` used by 6 routes |
| **15 API routes** | All rewritten from `createServerClient()` / `createClient()` to raw pg SQL |
| **Deleted** | `lib/supabase/server.js`, `lib/supabase/client.js`, `migration/data-dump-supabase.sql` |
| **Removed** | `@supabase/supabase-js`, `@auth/supabase-adapter` from `package.json` |
| **Bugs fixed** | `preferred_lang` schema drift (Stage 1); lead-digest dedup key mismatch (post-3b) |

---

## Current State

**Infrastructure**
- **Database:** Neon PostgreSQL 17 — accessed exclusively via `pg` singleton pool (`lib/db.js`); no ORM at runtime
- **Auth:** NextAuth v4, Google OAuth; sign-in upserts user row and stamps `last_signed_in_at`
- **Hosting:** Vercel (auto-deploy on push to `main`); production at `https://bt.cyber-tech.com`
- **Email:** Resend + React Email templates; cron at 14:00 UTC daily via `vercel.json`
- **Supabase:** fully decommissioned — no packages, no imports, no runtime calls

**Features**
- Per-user language preference: `zh` (Traditional Chinese, default) or `en` (English)
- Language toggle in avatar dropdown — persists to DB on click, page reloads immediately
- Full Traditional Chinese UI for `zh` users; full English UI for `en` users across all pages, components, AI responses, and email subjects/body
- AI summary and chat respond in the session user's `preferred_lang`; voice input switches between zh-TW and en-US
- Email digests and overdue reminders sent in each recipient's `preferred_lang`; lead digests properly deduped per user per day
- Three-tier task permission model: admin/lead → assignee → creator
- Task description + inline title editing; task types (event-scoped, admin-managed)
- AI 助理 page (admin/lead only): AI summary with time range selector + multi-turn chat with voice input
- Status updates: modal with activity/reporter/time; clickable activity filter on Activities page
- Nav: home icon (left) + centered page links + avatar (right); AI tab for admin/lead only
- Task tabs: 全部任務 / 我的任務（按狀態）/ 我的任務（按活動）
- Mobile: fixed bottom tab bar with HOME + event nav tabs; +2px font on mobile

---

## Pending / Next Steps

- **`ANTHROPIC_API_KEY`** must be set in Vercel env vars (AI routes will 500 without it)
- **`CRON_SECRET`** must be set in Vercel env vars (cron will be unprotected without it)
- Trigger announcement emails from Activities page (announcements are posted to DB but no send button exists yet)
- Consider per-event role context (currently session role = highest role across all events)
- Purge git history of `migration/data-dump-supabase.sql` if PII scrubbing is ever required (`git filter-repo`)
- **Verify Stage 1 in browser** — Vincent to sign in and confirm the Locations list, detail page, and admin add/edit (with photo) all work end to end before Stage 2 starts, per the spec's own per-stage sign-off rule.
- **Verify Stage 2 in browser** — Vincent to sign in and run through create (QTY 3, check one tag ID assigned), photo gallery (upload, set primary, delete), damage-% → displayable rule, and each filter on the list page, per the spec's per-stage sign-off rule.
- **Verify Stage 3 on-site** — Vincent to actually walk one real location, confirm Quick Inspect + new-lantern timing feels right, try Add to Home Screen, and (ideally) test what happens to an in-progress form if the connection actually drops, per the spec's per-stage sign-off rule.
- **Real icon branding** — `public/icons/lantern-*.png` are solid-color placeholders generated by `scripts/generate-inventory-icons.js`; swap for real artwork when available.
- **Lantern Inventory Stage 4** (management view: dashboard counts by condition/category/voltage/location, display-decision field + "Fair 2027 shortlist" view, CSV export + photo ZIP) is next, per the 6-stage plan. Stage 5 follows (QR labels + scan-to-open in Field mode).
- Still-open spec questions (Section 6): final tag label material, and who the Viewers are (role is modeled, nobody assigned yet).
- Additional inventory subsystems (beyond Lanterns) to be added to `INVENTORY_MODULES` in `lib/inventory.js` as they're defined
