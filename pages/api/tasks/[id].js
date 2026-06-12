import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

export default async function handler(req, res) {
  const { id } = req.query
  const supabase = createServerClient()
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'PUT') {
    const { status, note, title, activity_id, assignee_1_id, assignee_2_id, due_date } = req.body
    const userId   = session.user.id
    const userRole = session.user.role

    const isStatusNoteOnly = (status !== undefined || note !== undefined) &&
      !title && !activity_id && !assignee_1_id && !assignee_2_id && !due_date

    if (isStatusNoteOnly) {
      const { data: task } = await supabase
        .from('tasks')
        .select('assignee_1_id, assignee_2_id, status, title, activity:activity_id(event_id)')
        .eq('id', id)
        .single()
      if (!task) return res.status(404).json({ error: 'Not found' })

      const isAssignee = task.assignee_1_id === userId || task.assignee_2_id === userId
      if (!isAssignee && !['admin', 'lead'].includes(userRole)) {
        return res.status(403).json({ error: 'Forbidden' })
      }

      const eventId = task.activity?.event_id ?? null
      const update = { updated_at: new Date().toISOString() }
      if (status !== undefined) update.status = status
      if (note !== undefined) update.note = note

      const { data, error } = await supabase
        .from('tasks').update(update).eq('id', id).select().single()
      if (error) return res.status(500).json({ error: error.message })

      const logEntries = []
      const base = { event_id: eventId, user_id: userId, entity_type: 'task', entity_id: id, entity_name: task.title }

      if (status !== undefined) {
        logEntries.push({ ...base, action: 'status_changed', field_changed: 'status', old_value: task.status, new_value: status })
      }
      if (note !== undefined && note) {
        logEntries.push({ ...base, action: 'note_added', note })
      }
      if (logEntries.length) await supabase.from('activity_log').insert(logEntries)

      return res.status(200).json(data)
    }

    // Full edit — admin/lead only
    if (!['admin', 'lead'].includes(userRole)) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const { data: taskMeta } = await supabase
      .from('tasks')
      .select('title, status, due_date, assignee_1_id, assignee_2_id, activity:activity_id(event_id)')
      .eq('id', id)
      .single()
    if (!taskMeta) return res.status(404).json({ error: 'Not found' })

    const eventId = taskMeta.activity?.event_id ?? null
    const update = { updated_at: new Date().toISOString() }
    if (title !== undefined)        update.title          = title
    if (activity_id !== undefined)  update.activity_id    = activity_id
    if (status !== undefined)       update.status         = status
    if (note !== undefined)         update.note           = note
    if (assignee_1_id !== undefined) update.assignee_1_id = assignee_1_id
    if (assignee_2_id !== undefined) update.assignee_2_id = assignee_2_id || null
    if (due_date !== undefined)     update.due_date       = due_date || null

    const { data, error } = await supabase
      .from('tasks').update(update).eq('id', id).select().single()
    if (error) return res.status(500).json({ error: error.message })

    const base = { event_id: eventId, user_id: userId, entity_type: 'task', entity_id: id, entity_name: taskMeta.title }
    const logEntries = []

    if (title !== undefined && title !== taskMeta.title) {
      logEntries.push({ ...base, action: 'updated', field_changed: 'title', old_value: taskMeta.title, new_value: title })
    }
    if (status !== undefined && status !== taskMeta.status) {
      logEntries.push({ ...base, action: 'status_changed', field_changed: 'status', old_value: taskMeta.status, new_value: status })
    }
    if (due_date !== undefined) {
      logEntries.push({ ...base, action: 'updated', field_changed: 'due_date', old_value: taskMeta.due_date ?? null, new_value: due_date || null })
    }
    if (assignee_1_id !== undefined && assignee_1_id !== taskMeta.assignee_1_id) {
      logEntries.push({ ...base, action: 'updated', field_changed: 'assignee_1', old_value: taskMeta.assignee_1_id, new_value: assignee_1_id })
    }
    if (assignee_2_id !== undefined && (assignee_2_id || null) !== taskMeta.assignee_2_id) {
      logEntries.push({ ...base, action: 'updated', field_changed: 'assignee_2', old_value: taskMeta.assignee_2_id, new_value: assignee_2_id || null })
    }
    if (note !== undefined && note) {
      logEntries.push({ ...base, action: 'note_added', note })
    }
    if (!logEntries.length) {
      logEntries.push({ ...base, action: 'updated' })
    }
    await supabase.from('activity_log').insert(logEntries)

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
