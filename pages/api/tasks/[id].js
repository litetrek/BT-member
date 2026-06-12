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
    const userId = session.user.id
    const userRole = session.user.role

    // Status/note update — assignees (or admin/lead) only
    const isStatusNoteOnly = (status !== undefined || note !== undefined) &&
      !title && !activity_id && !assignee_1_id && !assignee_2_id && !due_date

    if (isStatusNoteOnly) {
      const { data: task } = await supabase
        .from('tasks')
        .select('assignee_1_id, assignee_2_id, activity:activity_id(event_id)')
        .eq('id', id)
        .single()
      if (!task) return res.status(404).json({ error: 'Not found' })

      const isAssignee = task.assignee_1_id === userId || task.assignee_2_id === userId
      if (!isAssignee && !['admin', 'lead'].includes(userRole)) {
        return res.status(403).json({ error: 'Forbidden' })
      }

      const update = { updated_at: new Date().toISOString() }
      if (status !== undefined) update.status = status
      if (note !== undefined) update.note = note

      const { data, error } = await supabase
        .from('tasks')
        .update(update)
        .eq('id', id)
        .select()
        .single()
      if (error) return res.status(500).json({ error: error.message })

      await supabase.from('activity_log').insert({
        event_id: task.activity?.event_id ?? null,
        task_id: id,
        user_id: userId,
        action: status !== undefined ? 'task_status_changed' : 'task_note_updated',
        note: status !== undefined ? status : (note || null),
      })

      return res.status(200).json(data)
    }

    // Full edit — admin/lead only
    if (!['admin', 'lead'].includes(userRole)) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    // Get event_id for logging
    const { data: taskMeta } = await supabase
      .from('tasks')
      .select('activity:activity_id(event_id)')
      .eq('id', id)
      .single()

    const update = { updated_at: new Date().toISOString() }
    if (title !== undefined) update.title = title
    if (activity_id !== undefined) update.activity_id = activity_id
    if (status !== undefined) update.status = status
    if (note !== undefined) update.note = note
    if (assignee_1_id !== undefined) update.assignee_1_id = assignee_1_id
    if (assignee_2_id !== undefined) update.assignee_2_id = assignee_2_id || null
    if (due_date !== undefined) update.due_date = due_date || null

    const { data, error } = await supabase
      .from('tasks')
      .update(update)
      .eq('id', id)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })

    await supabase.from('activity_log').insert({
      event_id: taskMeta?.activity?.event_id ?? null,
      task_id: id,
      user_id: userId,
      action: 'task_updated',
    })

    return res.status(200).json(data)
  }

  if (req.method === 'DELETE') {
    if (session.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' })

    const { data: taskMeta } = await supabase
      .from('tasks')
      .select('activity:activity_id(event_id)')
      .eq('id', id)
      .single()

    // Log before delete (task_id becomes null after ON DELETE SET NULL)
    await supabase.from('activity_log').insert({
      event_id: taskMeta?.activity?.event_id ?? null,
      task_id: id,
      user_id: session.user.id,
      action: 'task_deleted',
    })

    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(204).end()
  }

  res.setHeader('Allow', ['PUT', 'DELETE'])
  return res.status(405).end()
}
