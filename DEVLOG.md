# DEVLOG — BT-Member

Session log for the Lantern Inventory roadmap (Phases 1–7). Older history lives in
`PROGRESS.md`.

---

## 2026-10-28 — Lantern Inventory Phase 1: Plan

Branch: `phase1-lantern-foundations`

### Repo vs. task-spec differences (adapted, not blocking)
- DB is **Neon via raw `pg`** (`lib/db.js`) with Prisma used only for `db push`; the
  BT-member Supabase project is paused. "Migrations" therefore = new Prisma models +
  an idempotent `scripts/migrate-*.js`, matching the existing pattern.
- **No RLS** exists on any `inv_lantern_*` table — all access goes through API routes
  gated by `requireInventoryRole()`. New tables follow the same model ("consistent
  with existing lantern tables").
- Tables use the repo's `inv_lantern_` prefix: `inv_lantern_events`, `inv_lantern_settings`.
- JavaScript (not TypeScript); no test runner exists → tests use Node's built-in
  `node --test` (no new dependency).
- Lantern schema has **no tags column** → tags are skipped in 1.4.

### Migrations to add
- `scripts/migrate-phase1-lantern-events-settings.js` (+ matching models in
  `prisma/schema.prisma` so a later `prisma db push` doesn't drop them):
  - `inv_lantern_events` (id, lantern_id, event_type CHECK in 7 types, actor, changes
    jsonb, session_id uuid null, note, created_at) + index on (lantern_id, created_at)
  - `inv_lantern_settings` (key PK, value jsonb, updated_at, updated_by), seeded with the
    current threshold: cloth 30, frame 30 (rule unchanged: not displayable when damage ≥ threshold)

### Files to touch
- 1.0 `lib/inventoryEvents.js` (new: diff + insert); write events in
  `api/inventory/lanterns/index.js` (created), `lanterns/[tagId].js` (updated / moved /
  status_changed), `lanterns/[tagId]/display-decision.js`, `inspections/index.js`
  (inspected), `photos/*` (photo_added / photo_deleted)
- 1.1 `api/inventory/locations/index.js` (+ SUM qty), `api/inventory/dashboard.js`,
  `field/index.jsx`, `locations/index.jsx`, `dashboard.jsx`
- 1.2 `lib/inventoryLocationSort.js` (new) + `tests/inventoryLocationSort.test.mjs`; used by
  locations API, dashboard API and both zone-grouped grids
- 1.3 `lib/inventoryConstants.js` (UNASSIGNED code), `inventoryLanternFilters.js`
  (`location_id=none`), `api/inventory/locations/[code].js` (pseudo-location),
  field + locations pages (bucket card), `field/[code].jsx`, `locations/[code].jsx`, list filter
- 1.4 `InventoryLanternForm.jsx` (Status, Display decision), `InventoryQuickInspectSheet.jsx`
  (Missing), fix PUT so cleared fields (e.g. location → —) actually clear
- 1.5 `lib/inventoryEligibility.js` (new, pure), `lib/inventorySettings.js` (new, server),
  `api/inventory/settings.js` (new), `components/InventoryDisplayableBadge.jsx` (new popover),
  list + detail pages, `admin.jsx` (threshold form)
- 1.6 list page search placeholder/width

---

## 2026-10-28 — Lantern Inventory Phase 1: Results

All Phase 1 items built on `phase1-lantern-foundations`. Migration run against Neon by
Vincent on 2026-10-28 (all 5 steps OK); PR #1 merged the same day.

### What changed
- **1.0 Event log** — `inv_lantern_events` + `lib/inventoryEvents.js` / `lib/inventoryEventDiff.js`.
  Events written on: create (`created`), edit (`updated`, or `moved` / `status_changed` when
  that's the only change), display-decision endpoint (`updated`), Quick Inspect (`inspected`,
  always, note = inspection notes), photo add/delete (`photo_added` / `photo_deleted`),
  threshold change recompute (`updated`, note names the threshold change). No-op edits write
  nothing. Event writes never fail the save. `session_id` accepted on inspections for Phase 3.
  Existing `inv_lantern_activity_log` writes are kept (detail page "History" still reads it).
- **1.1 Counts** — locations API returns `lantern_qty`; field mode, 地點 and dashboard By
  Location show `N 筆 · M 盞` (`formatLocationCounts`).
- **1.2 Natural sort** — `lib/inventoryLocationSort.js` (named per repo convention instead of
  `lib/inventory/sortLocations.ts`). Locations API and dashboard sort with it, so every
  dropdown/grid inherits it; grids group via `groupLocationsByZone` (unknown zones no longer
  vanish). Tests: `tests/inventoryLocationSort.test.mjs`.
- **1.3 Unassigned** — pseudo-location code `unassigned` (`GET /api/inventory/locations/unassigned`),
  amber bucket card in 現場模式 and 地點, Unassigned option (`location_id=none`) in the list
  filter, Unassigned row in dashboard By Location. Field mode for Unassigned shows a location
  picker in Quick Inspect so lanterns can be assigned on the spot. `unassigned` is now a
  reserved location code.
- **1.4 Edit form** — Status (Active/Retired/Missing) and Display decision selects (edit only).
  Quick Inspect: 在場 Present / 遺失 Missing toggle (hidden for Retired). **Bug fixed**: the PUT
  used `body.x ?? existing.x`, so clearing a field (location "—", display decision, notes…)
  was silently ignored; nullable fields can now be cleared. PUT now validates status /
  condition / display_decision. Tags: **skipped — no tags column in the schema.**
- **1.5 Thresholds** — `inv_lantern_settings` (seeded 30/30 = old hard-coded value; rule
  unchanged: not displayable when damage ≥ threshold). `lib/inventoryEligibility.js`
  `evaluateDisplayability()` returns `{ displayable, reasons }`; list/detail APIs add
  `displayable_reasons`. `InventoryDisplayableBadge` popover opens on tap and hover, clamped to
  the viewport. 管理 has a threshold form (`PUT /api/inventory/settings`, admin only) that
  recomputes `displayable` on every lantern. If the settings table is missing, code falls back
  to 30/30.
- **1.6 Search** — placeholder `搜尋 編號/名稱 Search`, full-width on mobile.

### Migrations added
- `scripts/migrate-phase1-lantern-events-settings.js` (idempotent) + matching Prisma models
  `InventoryLanternEvent`, `InventoryLanternSetting`.

### Verification (local Postgres 16 with lookalike data, prod build)
- `npm test` 10/10 · `next lint` 0 errors · `next build` clean.
- Migration run twice (idempotent); CHECK constraint present.
- A1 = 8 筆 · 29 盞 in field mode, 地點 and dashboard; order A1 A2 A3 A10 A11 … E3 E10 Cabin.
- LT-0037 / LT-0047 reachable from list filter, 地點 bucket, field bucket.
- LT-0015 / LT-0017 show reasons; threshold 30→50→30 flips both and logs events.
- Every write path produced the expected `inv_lantern_events` row; editor gets 403 on settings.
- All changed screens at 375px and 1280px: no horizontal scroll, no JS errors.

### To deploy
1. `node scripts/migrate-phase1-lantern-events-settings.js` (uses `.env.local` DATABASE_URL).
2. Merge / deploy; spot-check A1, LT-0015/17, LT-0037/47 on real data.
3. If you later run `npx prisma db push`, the new models are in the schema so it won't drop them.

### Left unfinished / notes for later phases
- No timeline UI (Phase 4) — events are written only.
- Tags not implemented (no schema column).
- The SQL recompute in `PUT /api/inventory/settings` duplicates the eligibility rule; keep it
  in sync with `evaluateDisplayability()` if the rule grows (e.g. status-based reasons).
- `npm test` relies on Node ≥ 22 auto-detecting ESM (prints a harmless MODULE_TYPELESS warning).

---

## 2026-10-29 — Lantern name fields unified (ZH + EN)

- **Problem**: 現場模式 → 新增燈籠 New → 燈籠資料 Details had a single 「名稱 Name」 input (saved to
  `name_zh`); there was no way to enter an English name, unlike the New / Edit form.
- **New** `components/InventoryLanternNameFields.jsx` — 名稱（中文）Name (ZH) (required) +
  名稱（英文）Name (EN) (optional). Used by all three forms: field-mode New
  (`InventoryFieldNewLanternSheet`, stacked layout), and New + Edit (`InventoryLanternForm`).
  Saves to the same columns `name_zh` / `name_en`.
- **Location**: field-mode New already saved `location_id` = the location being walked; the
  details step now shows it (地點 Location: B4) so it's visible before saving.
- **Names trimmed** client- and server-side; a blank English name is stored as NULL; POST and PUT
  reject a Chinese name that's empty or only spaces.
- **Verified** (local Postgres, prod build, 375px): field New saved 蓮花燈 / Lotus Lantern at B4 and
  龍燈 / NULL at B4, each with a `created` event; New and Edit pages show both fields; no
  horizontal scroll, no JS errors; lint 0 errors, `npm test` 33/33, `next build` clean.

---

## 2026-10-29 — Photo thumbnails on lantern cards (現場模式 + 地點)

- **Requested** from the Cabin field-mode screen on iPhone: show a small picture of each lantern.
- `GET /api/inventory/locations/[code]` (and the Unassigned bucket) now returns
  `primary_photo_thumb_url` per lantern — the primary photo, else the first photo taken.
- **New** `components/InventoryLanternThumb.jsx` — thumbnail or grey 無照片 tile, lazy-loaded.
- 現場模式 `/inventory/lanterns/field/<地點>`: photo strip (full card width, 80px tall) at the top of
  each card; text below unchanged; ✓ badge sits on the photo. A side-by-side layout was tried
  first but wrapped the tag ID and QTY at 375px.
- 地點 `/inventory/lanterns/locations/<地點>`: 56px thumbnail beside each lantern, like the list page.
- **Verified** (local Postgres, prod build): Cabin with 8 lanterns (6 with photos, 2 without) at
  375px and 1280px — correct thumbs / 無照片 tiles, no horizontal scroll, no JS errors; lint 0 errors.
