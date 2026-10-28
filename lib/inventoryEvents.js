// Server-only: per-lantern event log (inv_lantern_events). Every create / edit / Quick
// Inspect / photo change writes one row with a { field: [before, after] } diff.
// The Phase 4 timeline reads this table; nothing renders it yet.
import { query } from '@/lib/db'
import { diffLanternFields } from '@/lib/inventoryEventDiff'

export { diffLanternFields, LANTERN_TRACKED_FIELDS, pickEventType } from '@/lib/inventoryEventDiff'

// Never lets a logging failure (e.g. migration not yet run) break the save that
// triggered it — the lantern change itself has already been committed.
export async function insertLanternEvent({ lantern_id, event_type, actor, changes, session_id, note }) {
  try {
    await query(
      `INSERT INTO inv_lantern_events (lantern_id, event_type, actor, changes, session_id, note)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6)`,
      [lantern_id, event_type, actor ?? null, JSON.stringify(changes ?? {}), session_id ?? null, note ?? null]
    )
  } catch (err) {
    console.error('[inventoryEvents] failed to write event:', event_type, lantern_id, err.message)
  }
}

// Convenience: diff two lantern rows and write one event (skips no-op edits).
export async function logLanternChange({ before, after, event_type, actor, note, session_id, always = false }) {
  const changes = diffLanternFields(before, after)
  if (!always && Object.keys(changes).length === 0) return null
  await insertLanternEvent({ lantern_id: after?.id ?? before?.id, event_type, actor, changes, session_id, note })
  return changes
}
