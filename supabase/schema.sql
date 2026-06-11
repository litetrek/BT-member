-- BT-Member Event Management Schema
-- Run this in Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── events ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  event_date  date NOT NULL,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read events"
  ON events FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can insert events"
  ON events FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM event_members em
      WHERE em.user_id = auth.uid() AND em.role = 'admin'
    )
  );

CREATE POLICY "Admins can update events"
  ON events FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM event_members em
      WHERE em.user_id = auth.uid() AND em.role = 'admin'
    )
  );

-- ── users ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        text,
  email       text NOT NULL UNIQUE,
  avatar_url  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read users"
  ON users FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can upsert their own record"
  ON users FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own record"
  ON users FOR UPDATE USING (id = auth.uid());

-- ── event_members ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_members (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'lead', 'member')),
  joined_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

ALTER TABLE event_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see their own memberships"
  ON event_members FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage memberships"
  ON event_members FOR ALL USING (
    EXISTS (
      SELECT 1 FROM event_members em
      WHERE em.user_id = auth.uid() AND em.role = 'admin'
    )
  );

-- ── activities ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activities (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  lead_id     uuid NOT NULL REFERENCES users(id),
  co_lead_id  uuid REFERENCES users(id),
  name        text NOT NULL,
  icon        text NOT NULL DEFAULT 'ti-star',
  sort_order  integer NOT NULL DEFAULT 0
);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read activities"
  ON activities FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can insert activities"
  ON activities FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM event_members em
      WHERE em.user_id = auth.uid() AND em.role = 'admin'
    )
  );

CREATE POLICY "Admins can update activities"
  ON activities FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM event_members em
      WHERE em.user_id = auth.uid() AND em.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete activities"
  ON activities FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM event_members em
      WHERE em.user_id = auth.uid() AND em.role = 'admin'
    )
  );

-- ── tasks ────────────────────────────────────────────────
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

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Assignees can see their tasks"
  ON tasks FOR SELECT USING (
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

CREATE POLICY "Admins and leads can insert tasks"
  ON tasks FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM event_members em
      JOIN activities a ON a.event_id = em.event_id
      WHERE a.id = tasks.activity_id
        AND em.user_id = auth.uid()
        AND em.role IN ('admin', 'lead')
    )
  );

CREATE POLICY "Assignees and admins can update tasks"
  ON tasks FOR UPDATE USING (
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

CREATE POLICY "Admins can delete tasks"
  ON tasks FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM event_members em
      JOIN activities a ON a.event_id = em.event_id
      WHERE a.id = tasks.activity_id
        AND em.user_id = auth.uid()
        AND em.role = 'admin'
    )
  );

-- ── announcements ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_by  uuid NOT NULL REFERENCES users(id),
  message     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read announcements"
  ON announcements FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can insert announcements"
  ON announcements FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM event_members em
      WHERE em.event_id = announcements.event_id
        AND em.user_id = auth.uid()
        AND em.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete announcements"
  ON announcements FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM event_members em
      WHERE em.event_id = announcements.event_id
        AND em.user_id = auth.uid()
        AND em.role = 'admin'
    )
  );

-- ── email_log ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_log (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id),
  task_id     uuid REFERENCES tasks(id),
  type        text NOT NULL CHECK (type IN ('daily_digest', 'overdue_reminder', 'announcement')),
  status      text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  sent_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read email_log"
  ON email_log FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can insert email_log"
  ON email_log FOR INSERT WITH CHECK (auth.role() = 'authenticated');
