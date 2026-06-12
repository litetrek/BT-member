import { useState, useEffect } from 'react'

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
]

export default function TaskForm({ slug, eventId, task, activities, onClose, onSaved, onDelete }) {
  const isEdit = !!task

  const [form, setForm] = useState({
    title: '',
    activity_id: activities[0]?.id ?? '',
    status: 'open',
    assignee_1_id: '',
    assignee_2_id: '',
    due_date: '',
  })
  const [users, setUsers] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title,
        activity_id: task.activity_id,
        status: task.status,
        assignee_1_id: task.assignee_1_id,
        assignee_2_id: task.assignee_2_id ?? '',
        due_date: task.due_date ?? '',
      })
    }
  }, [task])

  useEffect(() => {
    if (!eventId) return
    fetch(`/api/users?event_id=${eventId}`)
      .then((r) => r.json())
      .then((d) => setUsers(Array.isArray(d) ? d.filter((u) => u.status !== 'invited') : []))
      .catch(() => setUsers([]))
  }, [eventId])

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const body = {
      ...form,
      slug,
      assignee_2_id: form.assignee_2_id || null,
      due_date: form.due_date || null,
    }

    const url = isEdit ? `/api/tasks/${task.id}` : '/api/tasks'
    const method = isEdit ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      onSaved()
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Save failed')
    }
    setSaving(false)
  }

  const inputCls = 'w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400'

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-lg max-h-[90vh] overflow-y-auto">
        <h2 className="font-semibold text-gray-900 mb-4">{isEdit ? 'Edit Task' : 'New Task'}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Title</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Activity</label>
            <select
              value={form.activity_id}
              onChange={(e) => set('activity_id', e.target.value)}
              required
              className={inputCls}
            >
              <option value="">Select activity…</option>
              {activities.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <select value={form.status} onChange={(e) => set('status', e.target.value)} className={inputCls}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Assignee 1</label>
            <select
              value={form.assignee_1_id}
              onChange={(e) => set('assignee_1_id', e.target.value)}
              required
              className={inputCls}
            >
              <option value="">Select assignee…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Assignee 2 (optional)</label>
            <select
              value={form.assignee_2_id}
              onChange={(e) => set('assignee_2_id', e.target.value)}
              className={inputCls}
            >
              <option value="">None</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Due Date</label>
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => set('due_date', e.target.value)}
              className={inputCls}
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex items-center justify-between pt-2">
            {isEdit && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Delete task
              </button>
            )}
            <div className="flex gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
