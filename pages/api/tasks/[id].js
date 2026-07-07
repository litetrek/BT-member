import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query, insertLog } from '@/lib/db'

export default async function handler(req, res) {
  const { id } = req.query
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'PUT') {
    const { status, note, title, description, task_type, activity_id, assignee_1_id, assignee_2_id, due_date } = req.body
    const userId        = session.user.id
    const userRole      = session.user.role
    const isAdminOrLead = ['admin', 'lead'].includes(userRole)

    const { rows: [task] } = await query(
      `SELECT t.title, t.description, t.task_type, t.status, t.due_date,
              t.assignee_1_id, t.assignee_2_id, t.created_by, t.note,
              a.event_id AS activity_event_id
       FROM tasks t
       LEFT JOIN activities a ON a.id = t.activity_id
       WHERE t.id = $1`,
      [id]
    )
    if (!task) return res.status(404).json({ error: 'Not found' })

    const isAssignee = task.assignee_1_id === userId || task.assignee_2_id === userId
    const isCreator  = task.created_by === userId

    if (!isAdminOrLead && !isAssignee && !isCreator) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const eventId    = task.activity_event_id ?? null
    const base       = { event_id: eventId, user_id: userId, entity_type: 'task', entity_id: id, entity_name: task.title }
    const update     = { updated_at: new Date().toISOString() }
    const logEntries = []

    if (status !== undefined) {
      if (isAssignee || isAdminOrLead) {
        update.status = status
        if (status !== task.status) {
          logEntries.push({ ...base, action: 'status_changed', field_changed: 'status', old_value: task.status, new_value: status })
        }
      }
    }

    if (note !== undefined) {
      if (isAssignee || isAdminOrLead) {
        update.note = note
        if (note) logEntries.push({ ...base, action: 'note_added', note })
      }
    }

    if (title !== undefined && title !== task.title) {
      update.title = title
      logEntries.push({ ...base, action: 'updated', field_changed: 'title', old_value: task.title, new_value: title })
    }

    if (description !== undefined && description !== (task.description ?? '')) {
      update.description = description || null
      logEntries.push({
        ...base,
        action:        'updated',
        field_changed: 'description',
        old_value:     (task.description ?? '').substring(0, 100),
        new_value:     (description ?? '').substring(0, 100),
      })
    }

    if (task_type !== undefined && isAdminOrLead) {
      update.task_type = task_type || 'general'
      if (update.task_type !== (task.task_type ?? 'general')) {
        logEntries.push({ ...base, action: 'updated', field_changed: 'task_type', old_value: task.task_type, new_value: update.task_type })
      }
    }

    if (isAdminOrLead) {
      if (activity_id !== undefined)   update.activity_id   = activity_id
      if (assignee_1_id !== undefined) {
        update.assignee_1_id = assignee_1_id
        if (assignee_1_id !== task.assignee_1_id) {
          logEntries.push({ ...base, action: 'updated', field_changed: 'assignee_1', old_value: task.assignee_1_id, new_value: assignee_1_id })
        }
      }
      if (assignee_2_id !== undefined) {
        update.assignee_2_id = assignee_2_id || null
        if ((assignee_2_id || null) !== task.assignee_2_id) {
          logEntries.push({ ...base, action: 'updated', field_changed: 'assignee_2', old_value: task.assignee_2_id, new_value: assignee_2_id || null })
        }
      }
      if (due_date !== undefined) {
        update.due_date = due_date || null
        logEntries.push({ ...base, action: 'updated', field_changed: 'due_date', old_value: task.due_date ?? null, new_value: due_date || null })
      }
    }

    const fields      = Object.keys(update)
    const setClauses  = fields.map((f, i) => `${f} = $${i + 2}`).join(', ')
    const { rows: [data], rowCount } = await query(
      `UPDATE tasks SET ${setClauses} WHERE id = $1 RETURNING *`,
      [id, ...Object.values(update)]
    )
    if (!rowCount) return res.status(500).json({ error: 'Update failed' })

    if (logEntries.length) {
      for (const entry of logEntries) await insertLog(entry)
    }

    return res.status(200).json(data)
  }

  if (req.method === 'DELETE') {
    if (session.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' })

    const { rows: [taskMeta] } = await query(
      `SELECT t.title, a.event_id AS activity_event_id
       FROM tasks t
       LEFT JOIN activities a ON a.id = t.activity_id
       WHERE t.id = $1`,
      [id]
    )

    await insertLog({
      event_id:    taskMeta?.activity_event_id ?? null,
      user_id:     session.user.id,
      entity_type: 'task',
      entity_id:   id,
      entity_name: taskMeta?.title ?? null,
      action:      'deleted',
    })

    const { rowCount } = await query('DELETE FROM tasks WHERE id = $1', [id])
    if (!rowCount) return res.status(500).json({ error: 'Delete failed' })

    return res.status(204).end()
  }

  res.setHeader('Allow', ['PUT', 'DELETE'])
  return res.status(405).end()
}
