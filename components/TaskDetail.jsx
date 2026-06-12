import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Avatar from './Avatar'
import StatusBadge from './StatusBadge'

const STATUS_OPTIONS = [
  { value: 'open',        label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done',        label: 'Done' },
]

function relativeTime(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function describeEntry(entry) {
  const actor = entry.actor?.name ?? 'Someone'
  switch (entry.action) {
    case 'status_changed':
      return { text: `${actor} changed status`, detail: `${entry.old_value} → ${entry.new_value}` }
    case 'note_added':
      return { text: `${actor} added a note`, detail: entry.note ? `"${entry.note}"` : '' }
    case 'created':
      return { text: `Task created by ${actor}`, detail: '' }
    case 'deleted':
      return { text: `Task deleted by ${actor}`, detail: '' }
    case 'updated':
      return {
        text: `${actor} updated ${entry.field_changed ?? 'task'}`,
        detail: entry.old_value && entry.new_value ? `${entry.old_value} → ${entry.new_value}` : '',
      }
    default:
      return { text: `${actor} ${entry.action.replace(/_/g, ' ')}`, detail: '' }
  }
}

export default function TaskDetail({ task, onClose, onSaved }) {
  const { data: session } = useSession()
  const [status, setStatus]   = useState(task.status)
  const [note, setNote]       = useState(task.note ?? '')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [history, setHistory] = useState([])
  const [logLoading, setLogLoading] = useState(true)

  const userId   = session?.user?.id
  const userRole = session?.user?.role
  const isAssignee = task.assignee_1_id === userId || task.assignee_2_id === userId
  const canUpdate  = isAssignee || ['admin', 'lead'].includes(userRole)

  function loadHistory() {
    fetch(`/api/log?task_id=${task.id}`)
      .then((r) => r.json())
      .then((d) => { setHistory(Array.isArray(d) ? d : []); setLogLoading(false) })
      .catch(() => setLogLoading(false))
  }

  useEffect(() => { loadHistory() }, [task.id])

  async function handleSave() {
    setSaving(true)
    setError('')
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, note }),
    })
    if (res.ok) {
      onSaved()
      loadHistory()
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Save failed')
    }
    setSaving(false)
  }

  const assignee1 = task.assignee1
  const assignee2 = task.assignee2

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100 shrink-0">
          <div className="pr-4">
            <h2 className="text-base font-semibold text-gray-900 leading-snug">{task.title}</h2>
            {task.activity?.name && (
              <p className="text-xs text-gray-400 mt-0.5">{task.activity.name}</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0 mt-0.5">
            <span className="ti ti-x text-lg" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Task meta */}
          <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">Status</span>
              <StatusBadge status={task.status} dueDate={task.due_date} />
            </div>
            {task.due_date && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400">Due</span>
                <span className="text-xs text-gray-700">
                  {new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            )}
            {(assignee1 || assignee2) && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400">Assigned</span>
                <div className="flex -space-x-1">
                  {assignee1 && <Avatar name={assignee1.name ?? assignee1.email} avatarUrl={assignee1.avatar_url} size="sm" />}
                  {assignee2 && <Avatar name={assignee2.name ?? assignee2.email} avatarUrl={assignee2.avatar_url} size="sm" />}
                </div>
              </div>
            )}
          </div>

          {/* Update form */}
          {canUpdate && (
            <div className="px-5 py-4 border-b border-gray-100 flex flex-col gap-3">
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 shrink-0"
                >
                  {saving ? 'Saving…' : 'Update'}
                </button>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Note</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Add a note…"
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
          )}

          {/* Read-only note for non-editors */}
          {!canUpdate && task.note && (
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-xs text-gray-500 mb-1">Note</p>
              <p className="text-sm text-gray-700">{task.note}</p>
            </div>
          )}

          {/* History */}
          <div className="px-5 py-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">History</p>
            {logLoading ? (
              <p className="text-xs text-gray-400">Loading…</p>
            ) : history.length === 0 ? (
              <p className="text-xs text-gray-400">No history yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {history.map((entry) => {
                  const { text, detail } = describeEntry(entry)
                  return (
                    <div key={entry.id} className="flex items-start gap-2.5">
                      <Avatar
                        name={entry.actor?.name ?? '?'}
                        avatarUrl={entry.actor?.avatar_url}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-700">{text}</p>
                        {detail && (
                          <p className="text-xs text-gray-500 mt-0.5 italic">{detail}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">{relativeTime(entry.created_at)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
