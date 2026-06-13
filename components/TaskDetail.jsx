import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Avatar from './Avatar'
import StatusBadge from './StatusBadge'
import { useLang } from '@/context/LangContext'
import { t } from '@/lib/lang'

function relativeTime(ts, lang) {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (lang === 'en') {
    if (mins < 1)  return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24)  return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }
  if (mins < 1)  return '剛剛'
  if (mins < 60) return `${mins} 分鐘前`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs} 小時前`
  return `${Math.floor(hrs / 24)} 天前`
}

function describeEntry(entry, lang) {
  const actor = entry.actor?.name ?? t(lang, 'Someone', '某人')
  switch (entry.action) {
    case 'status_changed':
      return {
        text:   t(lang, `${actor} changed status`, `${actor} 更改了狀態`),
        detail: `${entry.old_value} → ${entry.new_value}`,
      }
    case 'note_added':
      return {
        text:   t(lang, `${actor} added a note`, `${actor} 新增了備注`),
        detail: entry.note ? `「${entry.note}」` : '',
      }
    case 'created':
      return { text: t(lang, `Task created by ${actor}`, `任務由 ${actor} 建立`), detail: '' }
    case 'deleted':
      return { text: t(lang, `Task deleted by ${actor}`, `任務由 ${actor} 刪除`), detail: '' }
    case 'updated':
      return {
        text:   t(lang, `${actor} updated ${entry.field_changed ?? 'task'}`, `${actor} 更新了 ${entry.field_changed ?? '任務'}`),
        detail: entry.old_value && entry.new_value ? `${entry.old_value} → ${entry.new_value}` : '',
      }
    default:
      return { text: `${actor} ${entry.action.replace(/_/g, ' ')}`, detail: '' }
  }
}

const STATUS_OPTIONS = (lang) => [
  { value: 'open',        label: t(lang, 'Not Started', '未開始') },
  { value: 'in_progress', label: t(lang, 'In Progress', '進行中') },
  { value: 'done',        label: t(lang, 'Done',        '已完成') },
]

export default function TaskDetail({ task, onClose, onSaved }) {
  const { data: session } = useSession()
  const lang = useLang()

  const [displayTitle, setDisplayTitle] = useState(task.title)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft]     = useState(task.title)
  const [titleSaving, setTitleSaving]   = useState(false)
  const [status, setStatus]   = useState(task.status)
  const [note, setNote]       = useState(task.note ?? '')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [history, setHistory] = useState([])
  const [logLoading, setLogLoading] = useState(true)

  const userId   = session?.user?.id
  const userRole = session?.user?.role
  const isAssignee   = task.assignee_1_id === userId || task.assignee_2_id === userId
  const isCreator    = task.created_by === userId
  const canUpdate    = isAssignee || ['admin', 'lead'].includes(userRole)
  const canEditTitle = isAssignee || isCreator || ['admin', 'lead'].includes(userRole)

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
      setError(d.error ?? t(lang, 'Save failed', '儲存失敗'))
    }
    setSaving(false)
  }

  async function handleSaveTitle() {
    const newTitle = titleDraft.trim()
    if (!newTitle || newTitle === displayTitle) { setEditingTitle(false); return }
    setTitleSaving(true)
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle }),
    })
    if (res.ok) {
      setDisplayTitle(newTitle)
      setEditingTitle(false)
      loadHistory()
      onSaved()
    }
    setTitleSaving(false)
  }

  const assignee1 = task.assignee1
  const assignee2 = task.assignee2
  const dateLocale = lang === 'en' ? 'en-US' : 'zh-TW'

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100 shrink-0">
          <div className="pr-4 flex-1 min-w-0">
            {editingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') setEditingTitle(false) }}
                  className="flex-1 min-w-0 text-base font-semibold text-gray-900 border border-gray-300 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <button
                  onClick={handleSaveTitle}
                  disabled={titleSaving}
                  className="text-xs text-blue-600 hover:text-blue-700 shrink-0"
                >
                  {titleSaving ? '…' : t(lang, 'Save', '儲存')}
                </button>
                <button
                  onClick={() => setEditingTitle(false)}
                  className="text-xs text-gray-400 hover:text-gray-600 shrink-0"
                >
                  {t(lang, 'Cancel', '取消')}
                </button>
              </div>
            ) : (
              <h2
                className={`text-base font-semibold text-gray-900 leading-snug ${canEditTitle ? 'cursor-pointer hover:text-blue-600' : ''}`}
                onClick={canEditTitle ? () => { setTitleDraft(displayTitle); setEditingTitle(true) } : undefined}
                title={canEditTitle ? t(lang, 'Click to edit title', '點擊以編輯標題') : undefined}
              >
                {displayTitle}
              </h2>
            )}
            {task.activity?.name && (
              <p className="text-xs text-gray-400 mt-0.5">{task.activity.name}</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0 mt-0.5">
            <span className="ti ti-x text-lg" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Description */}
          {task.description && (
            <div className="px-5 py-3 border-b border-gray-100">
              <p className="text-xs text-gray-400 mb-1">{t(lang, 'Description', '任務描述')}</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded px-3 py-2 leading-relaxed whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          {/* Task meta */}
          <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">{t(lang, 'Status', '狀態')}</span>
              <StatusBadge status={task.status} dueDate={task.due_date} />
            </div>
            {task.task_type && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400">{t(lang, 'Type', '任務類型')}</span>
                <span className="text-xs font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                  {task.task_type}
                </span>
              </div>
            )}
            {task.due_date && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400">{t(lang, 'Due', '到期日')}</span>
                <span className="text-xs text-gray-700">
                  {new Date(task.due_date + 'T00:00:00').toLocaleDateString(dateLocale, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            )}
            {(assignee1 || assignee2) && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400">{t(lang, 'Assignee', '負責人')}</span>
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
                  <label className="block text-xs text-gray-500 mb-1">{t(lang, 'Status', '狀態')}</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  >
                    {STATUS_OPTIONS(lang).map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 shrink-0"
                >
                  {saving ? t(lang, 'Saving…', '儲存中…') : t(lang, 'Update', '更新')}
                </button>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t(lang, 'Note', '備注')}</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder={t(lang, 'Add a note…', '新增備注…')}
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
          )}

          {/* Read-only note for non-editors */}
          {!canUpdate && task.note && (
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-xs text-gray-500 mb-1">{t(lang, 'Note', '備注')}</p>
              <p className="text-sm text-gray-700">{task.note}</p>
            </div>
          )}

          {/* History */}
          <div className="px-5 py-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
              {t(lang, 'History', '歷史記錄')}
            </p>
            {logLoading ? (
              <p className="text-xs text-gray-400">{t(lang, 'Loading…', '載入中…')}</p>
            ) : history.length === 0 ? (
              <p className="text-xs text-gray-400">{t(lang, 'No history yet.', '尚無記錄。')}</p>
            ) : (
              <div className="flex flex-col gap-3">
                {history.map((entry) => {
                  const { text, detail } = describeEntry(entry, lang)
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
                        <p className="text-xs text-gray-400 mt-0.5">{relativeTime(entry.created_at, lang)}</p>
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
