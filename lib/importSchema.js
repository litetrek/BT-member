import { query } from '@/lib/db'

// Additive schema for the unified import. Applied on first use from the import API
// routes (Vercel can reach Neon; local shells may not), so nothing has to be run by
// hand. Every statement is IF NOT EXISTS: existing tables and data are never changed.
// scripts/migrate-import.js applies the same statements manually if preferred.
export const IMPORT_DDL = [
  // Where an imported status update / task came from.
  `ALTER TABLE announcements ADD COLUMN IF NOT EXISTS source         text`,
  `ALTER TABLE announcements ADD COLUMN IF NOT EXISTS source_key     text`,
  `ALTER TABLE announcements ADD COLUMN IF NOT EXISTS source_text    text`,
  `ALTER TABLE announcements ADD COLUMN IF NOT EXISTS imported_by_ai boolean NOT NULL DEFAULT false`,
  `CREATE UNIQUE INDEX IF NOT EXISTS announcements_source_key_uq ON announcements (source_key) WHERE source_key IS NOT NULL`,

  `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source         text`,
  `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_key     text`,
  `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_text    text`,
  `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS imported_by_ai boolean NOT NULL DEFAULT false`,
  `CREATE UNIQUE INDEX IF NOT EXISTS tasks_source_key_uq ON tasks (source_key) WHERE source_key IS NOT NULL`,

  // Photos attached to an activity (from imports; usable for manual uploads later).
  `CREATE TABLE IF NOT EXISTS activity_photos (
     id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     event_id     uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
     activity_id  uuid REFERENCES activities(id) ON DELETE SET NULL,
     url          text NOT NULL,
     thumb_url    text,
     caption      text,
     taken_at     timestamptz,
     sender_name  text,
     source       text,
     source_key   text,
     uploaded_by  uuid REFERENCES users(id) ON DELETE SET NULL,
     created_at   timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS activity_photos_source_key_uq ON activity_photos (source_key) WHERE source_key IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS activity_photos_event_idx ON activity_photos (event_id, activity_id)`,

  // Every chat message already processed for an event, so re-imports skip them —
  // including messages that produced nothing (chit-chat).
  `CREATE TABLE IF NOT EXISTS import_messages (
     event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
     msg_key     text NOT NULL,
     source      text,
     imported_at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (event_id, msg_key)
   )`,

  // Remembered "WhatsApp name → member" choices per event.
  `CREATE TABLE IF NOT EXISTS import_sender_map (
     event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
     sender_name text NOT NULL,
     user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
     updated_at  timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (event_id, sender_name)
   )`,
]

let ready = null

export function ensureImportSchema() {
  if (!ready) {
    ready = (async () => {
      for (const sql of IMPORT_DDL) {
        try {
          await query(sql)
        } catch (err) {
          // Two cold starts racing on CREATE ... IF NOT EXISTS can collide; the other won.
          if (!['23505', '42P07', '42701'].includes(err.code)) throw err
        }
      }
    })().catch((err) => {
      ready = null
      throw err
    })
  }
  return ready
}
