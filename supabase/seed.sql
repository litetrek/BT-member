-- Seed data for BT-Member
-- Run after schema.sql

-- Seed event
INSERT INTO events (id, name, slug, event_date, status)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'BT Annual Event 2026',
  '2026-annual-event',
  '2026-07-01',
  'active'
)
ON CONFLICT (slug) DO NOTHING;

-- Seed activities (lead_id references a real user — replace placeholder after first login)
-- These will need a valid lead_id; insert after at least one user exists
-- Example (uncomment and replace USER_ID_HERE):
-- INSERT INTO activities (event_id, lead_id, name, icon, sort_order) VALUES
--   ('a0000000-0000-0000-0000-000000000001', 'USER_ID_HERE', 'Wiser Game', 'ti-trophy', 1),
--   ('a0000000-0000-0000-0000-000000000001', 'USER_ID_HERE', 'Booths', 'ti-building-store', 2),
--   ('a0000000-0000-0000-0000-000000000001', 'USER_ID_HERE', 'Seminars', 'ti-microphone', 3);
