import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

export default async function handler(req, res) {
  const { id } = req.query
  const supabase = createServerClient()
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'PUT') {
    const { status, note, title, description, task_type, activity_id, assignee_1_id, assignee_2_id, due_date } = req.body
    const userId        = session.user.id
    const userRole      = session.user.role
    const isAdminOrLead = ['admin', 'lead'].includes(userRole)

    // Fetch task upfront — need created_by, description, and old values for logging
    const { data: task } = await supabase
      .from('tasks')
      .select('title, description, task_type, status, due_date, assignee_1_id, assignee_2_id, created_by, note, activity:activity_id(event_id)')
      .eq('id', id)
      .single()
    if (!task) return res.status(404).json({ error: 'Not found' })

    const isAssignee = task.assignee_1_id === userId || task.assignee_2_id === userId
    const isCreator  = task.created_by === userId

    // Must be admin/lead, assignee, or creator
    if (!isAdminOrLead && !isAssignee && !isCreator) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const eventId = task.activity?.event_id ?? null
    const base    = { event_id: eventId, user_id: userId, entity_type: 'task', entity_id: id, entity_name: task.title }
    const update  = { updated_at: new Date().toISOString() }
    const logEntries = []

    // status — assignee or admin/lead only (creator without assignee role: silently ignored)
    if (status !== undefined) {
      if (isAssignee || isAdminOrLead) {
        update.status = status
        if (status !== task.status) {
          logEntries.push({ ...base, action: 'status_changed', field_changed: 'status', old_value: task.status, new_value: status })
        }
      }
    }

    // note — assignee or admin/lead only
    if (note !== undefined) {
      if (isAssignee || isAdminOrLead) {
        update.note = note
        if (note) logEntries.push({ ...base, action: 'note_added', note })
      }
    }

    // title — creator, assignee, or admin/lead
    if (title !== undefined && title !== task.title) {
      update.title = title
      logEntries.push({ ...base, action: 'updated', field_changed: 'title', old_value: task.title, new_value: title })
    }

    // description — creator, assignee, or admin/lead
    if (description !== undefined && description !== (task.description ?? '')) {
      update.description = description || null
      logEntries.push({
        ...base,
        action: 'updated',
        field_changed: 'description',
        old_value: (task.description ?? '').substring(0, 100),
        new_value: (description ?? '').substring(0, 100),
      })
    }

    // task_type — admin/lead only
    if (task_type !== undefined && isAdminOrLead) {
      update.task_type = task_type || 'general'
      if (update.task_type !== (task.task_type ?? 'general')) {
        logEntries.push({ ...base, action: 'updated', field_changed: 'task_type', old_value: task.task_type, new_value: update.task_type })
      }
    }

    // Structural fields — admin/lead only
    if (isAdminOrLead) {
      if (activity_id !== undefined)  update.activity_id   = activity_id
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

    const { data, error } = await supabase.from('tasks').update(update).eq('id', id).select().single()
    if (error) return res.status(500).json({ error: error.message })
    if (logEntries.length) await supabase.from('activity_log').insert(logEntries)

    return res.status(200).json(data)
  }

  if (req.method === 'DELETE') {
    if (session.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' })

    const { data: taskMeta } = await supabase
      .from('tasks')
      .select('title, activity:activity_id(event_id)')
      .eq('id', id)
      .single()

    await supabase.from('activity_log').insert({
      event_id:    taskMeta?.activity?.event_id ?? null,
      user_id:     session.user.id,
      entity_type: 'task',
      entity_id:   id,
      entity_name: taskMeta?.title ?? null,
      action:      'deleted',
    })

    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(204).end()
  }

  res.setHeader('Allow', ['PUT', 'DELETE'])
  return res.status(405).end()
}
