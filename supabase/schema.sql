-- BT-Member Event Management Schema
-- Run this in Supabase SQL editor (or via scripts/run-schema.js)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ══════════════════════════════════════════════
-- TABLE DEFINITIONS (all tables first)
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS events (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  event_date  date NOT NULL,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        text,
  email       text NOT NULL UNIQUE,
  avatar_url  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_members (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'lead', 'member')),
  joined_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS activities (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  lead_id     uuid NOT NULL REFERENCES users(id),
  co_lead_id  uuid REFERENCES users(id),
  name        text NOT NULL,
  icon        text NOT NULL DEFAULT 'ti-star',
  sort_order  integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tasks (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  activity_id     uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  assignee_1_id   uuid NOT NULL REFERENCES users(id),
  assignee_2_id   uuid REFERENCES users(id),
  created_by      uuid NOT NULL REFERENCES users(id),
  title           text NOT NULL,
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done')),
  due_date        date,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS announcements (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_by  uuid NOT NULL REFERENCES users(id),
  message     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_log (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id),
  task_id     uuid REFERENCES tasks(id),
  type        text NOT NULL CHECK (type IN ('daily_digest', 'overdue_reminder', 'announcement')),
  status      text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  sent_at     timestamptz NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════
-- ROW LEVEL SECURITY (after all tables exist)
-- ══════════════════════════════════════════════

ALTER TABLE events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_log     ENABLE ROW LEVEL SECURITY;

-- events
CREATE POLICY "events_select" ON events
  FOR SELECT USING (true);  -- public: home page lists events without auth

CREATE POLICY "events_insert" ON events
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM event_members em WHERE em.user_id = auth.uid() AND em.role = 'admin')
  );

CREATE POLICY "events_update" ON events
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM event_members em WHERE em.user_id = auth.uid() AND em.role = 'admin')
  );

-- users
CREATE POLICY "users_select" ON users
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "users_insert" ON users
  FOR INSERT WITH CHECK (true);

CREATE POLICY "users_update" ON users
  FOR UPDATE USING (id = auth.uid());

-- event_members
CREATE POLICY "members_select" ON event_members
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "members_all_admin" ON event_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM event_members em WHERE em.user_id = auth.uid() AND em.role = 'admin')
  );

-- activities
CREATE POLICY "activities_select" ON activities
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "activities_insert" ON activities
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM event_members em WHERE em.user_id = auth.uid() AND em.role = 'admin')
  );

CREATE POLICY "activities_update" ON activities
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM event_members em WHERE em.user_id = auth.uid() AND em.role = 'admin')
  );

CREATE POLICY "activities_delete" ON activities
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM event_members em WHERE em.user_id = auth.uid() AND em.role = 'admin')
  );

-- tasks
CREATE POLICY "tasks_select" ON tasks
  FOR SELECT USING (
    assignee_1_id = auth.uid()
    OR assignee_2_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM event_members em
      JOIN activities a ON a.event_id = em.event_id
      WHERE a.id = tasks.activity_id
        AND em.user_id = auth.uid()
        AND em.role IN ('admin', 'lead')
    )
  );

CREATE POLICY "tasks_insert" ON tasks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM event_members em
      JOIN activities a ON a.event_id = em.event_id
      WHERE a.id = tasks.activity_id
        AND em.user_id = auth.uid()
        AND em.role IN ('admin', 'lead')
    )
  );

CREATE POLICY "tasks_update" ON tasks
  FOR UPDATE USING (
    assignee_1_id = auth.uid()
    OR assignee_2_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM event_members em
      JOIN activities a ON a.event_id = em.event_id
      WHERE a.id = tasks.activity_id
        AND em.user_id = auth.uid()
        AND em.role IN ('admin', 'lead')
    )
  );

CREATE POLICY "tasks_delete" ON tasks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM event_members em
      JOIN activities a ON a.event_id = em.event_id
      WHERE a.id = tasks.activity_id
        AND em.user_id = auth.uid()
        AND em.role = 'admin'
    )
  );

-- announcements
CREATE POLICY "announcements_select" ON announcements
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "announcements_insert" ON announcements
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM event_members em
      WHERE em.event_id = announcements.event_id
        AND em.user_id = auth.uid()
        AND em.role = 'admin'
    )
  );

CREATE POLICY "announcements_delete" ON announcements
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM event_members em
      WHERE em.event_id = announcements.event_id
        AND em.user_id = auth.uid()
        AND em.role = 'admin'
    )
  );

-- email_log
CREATE POLICY "email_log_select" ON email_log
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "email_log_insert" ON email_log
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ══════════════════════════════════════════════
-- DAY 3 ADDITIONS
-- ══════════════════════════════════════════════

-- Note field on tasks (applied Day 3)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS note text;

-- Description field on tasks (applied Day 4 — 2026-06-11)
-- ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description text;

-- Activity log
CREATE TABLE IF NOT EXISTS activity_log (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id    uuid REFERENCES events(id) ON DELETE CASCADE,
  task_id     uuid REFERENCES tasks(id) ON DELETE SET NULL,
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  action      text NOT NULL,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "log_select" ON activity_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM event_members
      WHERE event_id = activity_log.event_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "log_insert" ON activity_log
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
