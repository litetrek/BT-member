# BT Event Management System: Problem Analysis and Improvement Spec

Oct 28, 2026 · @Vincent

## Background and current state

The system is live, but almost no one except Vincent uses it. This spec is for Claude to implement the improvements.

- **URL:** bt.cyber-tech.com (2026 event: /2026-annual-event)
- **Stack:** Next.js / TypeScript / Tailwind, NextAuth.js, Supabase, Resend; deployed on Vercel
- **Pages:** 總覽 (Overview), 活動 (Activities), 任務 (Tasks), AI 助理 (AI Assistant), 成員 (Members)
- **UI language:** Traditional Chinese — keep it

| Metric | Value |
| --- | --- |
| Activities | 6 |
| Tasks | 5 (3 activities have no tasks at all) |
| Status updates | About 11, all on June 11–12, 2026 |
| Posted on behalf | Most were posted by Vincent for Susan and Joanna |
| Real members | 6 accounts; 2 are Vincent's, so 4 other people |
| Launch timing | Build started mid-June; event was June 30 — about two weeks |

## Why it failed

Root cause: the system is a project-management tool, but the volunteers' real work happens as conversation in WhatsApp and SMS. Using it was extra work that gave them nothing the group chat didn't, so the organizer ended up entering everything.

- **Launched too late:** released two weeks before the event, after coordination habits were set.
- **Required a behavior change:** log in, find the activity, fill a form — too high a bar for older, phone-first volunteers.
- **Small team:** only 4 other members; a group chat was already enough.
- **Wrong data shape:** the real content is free text ("bottles arrived", "Tammy will announce"), not structured tasks.
- **Wrong numbers hurt trust:** see the next section.
- **No reason to come back:** not yet confirmed whether the system sends any notifications or reminders.

**Design principle:** Don't ask volunteers to change their habits. Import data from the channels they already use, let AI organize it, and have a coordinator confirm it; everyone else only reads.

## Bugs to fix first

Fix these before sharing any board outside the core team.

| Page | Problem | Expected behavior |
| --- | --- | --- |
| Overview (總覽) | 逾期 (overdue) count shows 0 while a task below is tagged 逾期 | Overdue count matches task status |
| Overview | 總任務 (total tasks) shows 5, but 我的任務 (my tasks) lists only 3 | Label clearly as "all" vs "mine", or show both |
| Tasks | Every task date shows "Invalid Date" | Show the due date; when missing, show blank or 「未設定」 |
| Activities, Members | Show 尚無活動 / 尚無類型 ("none yet") before data loads | Show a loading state; show the empty state only when data is truly empty |
| Members | Vincent has two accounts ("Vincent Liteterk" is also misspelled) | Merge or deactivate the extra account |
| Home | Event date has passed (June 30, 2026) but still shows 進行中 (in progress) | Allow marking an event as ended |

## New feature: unified import

Add one import entry point on the AI 助理 page. It accepts three sources; AI turns the content into status updates and tasks, and a coordinator confirms before anything is saved.

### Three sources

| Source | How users get it | System handling |
| --- | --- | --- |
| WhatsApp group | Phone app → 匯出聊天 (Export Chat) → Without Media; iPhone gives a .zip containing a .txt, Android gives a .txt | Unzip; parse each message's date/time, sender and text |
| SMS | No built-in export; users copy and paste (iMazing or SMS Backup & Restore for large volumes) | A "paste text" box; free-form input |
| Files | Upload directly | Handled by format (table below) |

### File formats

| Format | Handling |
| --- | --- |
| PDF | AI reads it directly, including tables and scanned pages; split very long files |
| Photos (handwritten lists, whiteboards, receipts) | AI reads the image directly |
| Word (.docx) | Convert to text first (e.g. mammoth), then send to AI |
| Excel / CSV | Map roster-type data straight to columns (e.g. SheetJS); AI not always needed |
| Google Docs / Sheets | Users export to PDF or Excel first |

### Two kinds of files

- **Files with action items** (meeting notes, assignments, progress reports): AI extracts tasks and status updates.
- **Reference material** (schedules, rosters, site maps, quotes): store the original in Supabase Storage under its activity, and save the extracted text to the database so the AI assistant can answer questions like "Who are the referees?"

### Import flow

1. Coordinator picks the event and uploads a file or pastes text.
2. System parses the content. For WhatsApp exports, filter by date range and skip messages already imported (dedupe on timestamp + sender + text).
3. AI proposes a list: status updates (reporter, time, related activity) and tasks (title, owner, due date, activity, status). Map sender names to members and flag any that don't match.
4. Preview screen: each item can be checked, edited or removed, with the original message shown alongside.
5. Coordinator confirms and saves in one click; items are tagged "imported by AI" with their source.

Parsing rules need a real sample file: WhatsApp export date formats vary by phone language and region.

## Read-only board and SMS reminders

### Read-only board

Volunteers see the big picture from a link, with no login.

- One public link per event, with a random token in the URL; regenerating it invalidates the old link.
- Shows each activity's progress, owners, open and overdue tasks, and the latest status updates.
- Hides emails and other personal data.
- Mobile-first: large text, single column, Chinese UI.
- Coordinator posts the link to the WhatsApp group weekly (daily before the event).

### SMS reminders (phase 2)

- Use a service like Twilio to text owners when a task is nearly due.
- The owner replies 「完成」 (done) to mark the task complete automatically.
- Add a phone number field to members.
- App-to-person SMS in the US requires A2P 10DLC registration or toll-free verification, which takes days to weeks — start early.
- Don't start with a WhatsApp Business API bot: it generally can't join regular groups, outbound reminders are billed per message, and setup is more complex.

## Build order and open items

### Build order

1. Fix every issue in "Bugs to fix first."
2. Unified import: WhatsApp export and "paste text" first, then PDF and photos, then Word and Excel.
3. Read-only board.
4. SMS reminders (start the A2P 10DLC application at the same time).

### Rollout

- Start using it 2–3 months before the next event.
- Give a 10-minute demo at a real meeting.
- Encourage the team to keep event talk in the WhatsApp group; keep SMS for people without WhatsApp.

### Open items

- [ ] Provide a real WhatsApp export file to confirm the format
- [ ] Provide one or two typical sample files
- [ ] Confirm whether the system currently sends email notifications (Resend)
- [ ] Confirm whether the team mostly uses iPhone or Android
- [ ] Confirm the GitHub repo for the code
