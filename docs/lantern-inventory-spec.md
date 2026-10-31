# BT Lantern Inventory Control — Spec & Build Plan

Oct 25, 2026 · @Vincent

## 1. Purpose and scope

Build the **Lantern Inventory (燈籠庫存)** module under the existing Inventory Control hub in the BT Member portal, so the management team can see every lantern's condition and location and choose what to display at the March 2027 fair.

**Users**

| Role | Who | Can do |
| --- | --- | --- |
| Admin | vlin77@gmail.com | Everything, incl. managing categories, locations, users, deleting records |
| Editor (record keeper) | joannazhao168@gmail.com (Joanna Li), weiyanoble@gmail.com (Weiya Noble), qqandcici@gmail.com, pai8788@gmail.com | Add/edit lanterns, take photos, record inspections, move lanterns between locations |
| Viewer | Management team — none assigned yet | Browse, filter, view photos, export, mark display decisions (Stage 4) |

**In scope (this phase):** record keeping for lanterns and storage locations, photos, condition tracking with history, unique ID tags, iPhone-friendly on-site entry, filtering and export for decision-making.

**Out of scope for now:** check-in/check-out to events, repair work orders, costs and purchasing, other inventory types (the hub stays open for those later), native iOS app.

**Guiding rules for Claude Code**

- Follow the existing BT Member conventions: Next.js + TypeScript + Tailwind, NextAuth (Google sign-in), Supabase (Postgres + Storage), deployed on Vercel.
- Reuse the access gate already in `lib/inventory.js`; extend it with roles rather than building a second auth path.
- UI labels bilingual, Traditional Chinese first with English beneath, matching the existing hub page.
- Mobile-first: every screen must work one-handed on an iPhone in portrait.

## 2. Data model

One record per **lantern group**: either a single lantern, or several identical lanterns recorded together with a **QTY**. Each record gets one ID tag, one set of photos and one condition. Groups are never split into individual units.

**`lanterns`** — one record per lantern or group of identical lanterns

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | PK |
| tag\_id | text, unique | e.g. `LT-0001`; auto-assigned, sequential; every unit in the group carries the same tag |
| name\_zh / name\_en | text | e.g. 鯨魚 / Whale |
| category\_id | fk → categories | Ocean, Heaven, Forest, Lotus Garden… |
| qty | int ≥ 1 | Number of identical lanterns in this group (default 1) |
| voltage | enum | `AC110V`, `DC24V` |
| power\_w | numeric | Watts, one value per lantern |
| height\_ft / width\_ft / depth\_ft | numeric(5,2) | Feet, decimals allowed (e.g. 6.5) |
| location\_id | fk → locations | Current storage location |
| condition | enum | `Good`, `OK`, `Fair`, `Bad` — copied from latest inspection |
| cloth\_damage\_pct | int 0–100 | Latest value |
| frame\_damage\_pct | int 0–100 | Latest value |
| displayable | bool, generated | `false` when cloth **or** frame damage ≥ 30 % |
| status | enum | `Active`, `Retired`, `Missing` |
| display\_decision | enum, nullable | Stage 4: `Candidate`, `Selected`, `Needs repair`, `Not this year` |
| label\_attached | bool | Has the physical tag been stuck on? |
| notes | text |  |

**Group rules**

- A group's condition and damage % describe its **worst** unit, so the 30 % rule never hides a damaged lantern.
- A group sits at one location. If units are stored in two places, note it in `notes` or record a second group.
- The 30 % threshold is one config constant (`NOT_DISPLAYABLE_DAMAGE_PCT = 30`) so management can change it later.
- A lantern with `displayable = false` shows a red "不可展示 / Not displayable" badge everywhere and can't be marked `Selected`.

**`locations`** — storage spots

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | PK |
| code | text, unique | `A1`…`A10`, `B1`…`B10`, `C1`…`C10`, `D1`…`D6`, `Cabin`, `E1`…`E3` |
| zone | text | `A`, `B`, `C`, `D`, `E`, `Cabin` — for grouping |
| description | text | Where it is, how to access it |
| photo\_id | fk → photos |  |
| sort\_order | int | So A2 sorts before A10 |

**`inspections`** — condition history (one row each time someone checks a lantern)

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | PK |
| lantern\_id | fk → lanterns |  |
| inspected\_at | timestamptz |  |
| inspected\_by | text | User email from session |
| condition, cloth\_damage\_pct, frame\_damage\_pct | as above | Snapshot at that time |
| location\_id | fk → locations | Where it was found |
| notes | text |  |

Saving an inspection updates the lantern's current condition, damage % and location in the same transaction.

**`photos`** — shared by designs, lanterns, locations and inspections

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | PK |
| owner\_type / owner\_id | text / uuid | `lantern, location, inspection` |
| storage\_path | text | Supabase Storage key, bucket `lantern-photos` (private) |
| thumb\_path | text | \~400 px version for lists |
| is\_primary | bool | Photo shown in lists |
| taken\_at, uploaded\_by |  |  |

**`categories`** — admin-editable list (name\_zh, name\_en, sort\_order), seeded with Ocean, Heaven, Forest, Lotus Garden.

**`activity_log`** — who changed what and when (table, record id, action, changed fields, user, timestamp). Every table also carries `created_at/by`, `updated_at/by`.

## 3. Screens and flows

All routes live under the existing stub, e.g. `/inventory/lanterns/...`.

| Screen | Route | Purpose |
| --- | --- | --- |
| Lantern list | `/inventory/lanterns` | Card grid (phone) / table (desktop) with thumbnail, tag ID, name, QTY, category, voltage, condition badge, Not-displayable badge, location. Search by tag ID or name; filter by category, location, voltage, condition, displayable, status, display decision. Summary bar: total records, total QTY, count by condition. |
| Lantern detail | `/inventory/lanterns/[tagId]` | All fields incl. QTY and dimensions in ft, photo gallery, inspection history timeline, activity log. Buttons: Edit, Record inspection, Move, Add photo. |
| Add / edit lantern | `/inventory/lanterns/new`, `.../[tagId]/edit` | One form; QTY defaults to 1. Tag ID auto-assigned on save. |
| Locations | `/inventory/lanterns/locations` | Grouped by zone (A, B, C, D, E, Cabin), each showing photo, description and lantern count. Location detail lists every lantern stored there. |
| Field mode | `/inventory/lanterns/field` | Phone-optimized on-site workflow (below). |
| Labels | `/inventory/lanterns/labels` | Stage 5: print QR/tag labels (one per unit, so QTY 4 prints 4 copies). |
| Admin | `/inventory/lanterns/admin` | Categories, locations, user roles, CSV export. |

**On-site iPhone flow (Field mode)** — the core use case

1. Recorder opens Field mode and picks the location they are standing at (e.g. `B4`). The screen shows the location photo and every lantern currently recorded there.
2. For each lantern in front of them, they either tap an existing card, or scan its tag (Stage 5), or tap **+ New lantern**.
3. **Existing lantern** → "Quick inspect" sheet: big condition buttons (Good / OK / Fair / Bad), two sliders for cloth and frame damage (steps of 5 %), notes, **Take photo**. Save → next.
4. **New lantern** → take photo first, then enter name, category, QTY, voltage, power, dimensions (ft), condition, damage %. Tag ID is auto-assigned and shown large so it can be written on a temporary label right away.
5. Lanterns recorded in a different location than expected get moved automatically, with the move logged.
6. A progress line at the top shows "12 of 18 checked at B4", and a **Mark location done** button records the walkthrough date.

**Photo capture rules**

- Use `<input type="file" accept="image/*" capture="environment">` so iPhone Safari opens the rear camera directly; also allow picking from the photo library.
- Resize in the browser before upload (long edge \~1600 px, JPEG \~80 %) plus a \~400 px thumbnail, so uploads are fast on weak signal and storage stays small. Handle HEIC input.
- Multiple photos per lantern; one marked primary. Show upload progress and retry on failure without losing the form.

**Usability details for the phone**

- Touch targets at least 44 px, sticky Save button at the bottom, no hover-only actions.
- Forms keep a local draft so a dropped connection or accidental back-swipe doesn't lose data.
- Add-to-Home-Screen support (web app manifest + icon) so the module opens like an app.

## 4. Technical decisions

| Topic | Decision |
| --- | --- |
| Stack | Same as BT Member: Next.js (App Router) + TypeScript + Tailwind, NextAuth Google sign-in, Supabase Postgres, Vercel. No new services. |
| Database | New Supabase migrations, all tables prefixed `inv_lantern_` (or an `inventory` schema) to keep them apart from event data. Enums as Postgres enums or check constraints. |
| Data access | Server-side only (route handlers / server actions) using the service key; every handler checks the user's inventory role first. No direct client writes. |
| Permissions | Extend `lib/inventory.js` from a plain allowlist to `{ email: role }` `with roles admin, editor, viewer`. Later this can move to a DB table. |
| Photo storage | Private Supabase Storage bucket `lantern-photos`; path `lanterns/{lanternId}/{photoId}.jpg`, `locations/{code}/...`. Upload via signed upload URLs from the server; display via short-lived signed URLs. |
| Tag IDs | Format `LT-0001`, generated by a Postgres sequence so two editors can't collide. One tag ID per record; every unit in a group carries the same label. Never reused, even after retirement. |
| QR labels (Stage 5) | QR encodes the full URL `https://bt.cyber-tech.com/inventory/lanterns/LT-0001`; the iPhone camera opens it directly. Printable sheet for weatherproof labels (material not final, so keep label size configurable), tag ID also printed in large text. |
| Concurrency | `updated_at` check on save; if someone else edited first, show the newer values instead of overwriting. |
| Export | CSV of lanterns with current values and location; optional ZIP of primary photos. |
| Backup | Supabase daily backups plus a monthly CSV export saved by an admin. |
| Testing | Seed script with all locations and \~20 sample lanterns; test on a real iPhone (Safari) before each stage is signed off. |

## 5. Staged development plan

Six stages, each shippable and tested on an iPhone before the next starts. Stages 0–3 give the record keepers a working tool; aim to finish them by **mid-December 2026** so the full count can be done in January–February, leaving time for decisions before the March 2027 fair.

**Stage 0 — Foundation**

- Supabase migrations for all tables in section 2, the Storage bucket, tag-ID sequence.
- Roles in `lib/inventory.js` with the initial users from section 1; shared `requireInventoryRole()` helper.
- Seed: categories (Ocean, Heaven, Forest, Lotus Garden) and all locations A1–A10, B1–B10, C1–C10, D1–D6, Cabin, E1–E3.
- Photo upload utility: client-side resize + thumbnail, signed upload, signed display URL.
- *Done when:* migrations run cleanly, a test photo uploads from an iPhone and displays, a non-allowlisted account is blocked.

**Stage 1 — Locations**

- Locations list grouped by zone, location detail, add/edit with description and photo (admin).
- *Done when:* all locations show with photos and correct sort order (A2 before A10) on phone and desktop.

**Stage 2 — Lanterns: core records**

- Lantern CRUD with QTY, dimensions in ft, displayable rule, photo gallery with primary photo.
- Lantern list with search, filters and condition summary bar; lantern detail page.
- Activity log written on every change.
- *Done when:* an editor can create a lantern group with QTY 3, it gets one tag ID, condition and photos, a 35 % frame damage marks it Not displayable, and the list filters correctly.

**Stage 3 — Field mode (on-site iPhone)**

- Location-first walkthrough, Quick inspect sheet, new-lantern flow, auto-move, progress counter, local draft saving, home-screen manifest.
- Inspections table in use; detail page shows history timeline.
- *Done when:* a recorder can walk one real location (e.g. B4), inspect every lantern with photos in under \~1 minute each, and nothing is lost if signal drops mid-form.

**Stage 4 — Management view and export**

- Dashboard: counts by condition, category, voltage and location; average damage % per category.
- Display decision field with a "Fair 2027 shortlist" view (only displayable lanterns (cloth and frame damage under 30 %), filter by Good/OK and Selected/Candidate).
- CSV export; optional ZIP of primary photos.
- *Done when:* management can produce a shortlist of display-ready lanterns with photos and export it.

**Stage 5 — ID tags and QR**

- Printable label sheet (QR + large tag ID) for selected lanterns; `label_attached` tracking.
- Scan in Field mode: iPhone camera opens the lantern directly from the QR.
- *Done when:* printing labels for a location, sticking them on, and scanning opens the right record.

**Handoff notes for Claude Code**

- Work one stage per session; record progress in `DEVLOG.md` and put the next stage in `NEXT_TASK.md`.
- Don't change existing event/member tables or the portal's auth flow.
- Keep every new UI string bilingual (zh-TW + English).

## 6. Decisions (answered Oct 25, 2026)

| Question | Decision |
| --- | --- |
| Dimension units | Feet, decimals allowed |
| Power | One wattage per lantern |
| Identical lanterns | Recorded as one group with QTY; never split |
| Signal at storage sites | Cell signal available; no offline mode needed |
| Initial users | Admin + 4 Editors, listed in section 1 |
| Tag material | Not decided; probably weatherproof labels |
| Not-displayable threshold | Cloth or frame damage ≥ 30 % |

Still open: final tag material, and who the Viewers are.
