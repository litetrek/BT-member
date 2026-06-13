import { useState, useEffect } from 'react'
import { useLang } from '@/context/LangContext'
import { t } from '@/lib/lang'

export default function TaskForm({ slug, eventId, task, activities, onClose, onSaved, onDelete }) {
  const lang = useLang()
  const isEdit = !!task

  const STATUS_OPTIONS = [
    { value: 'open',        label: t(lang, 'Not Started', '未開始') },
    { value: 'in_progress', label: t(lang, 'In Progress', '進行中') },
    { value: 'done',        label: t(lang, 'Done',        '已完成') },
  ]

  const [form, setForm] = useState({
    title: '',
    description: '',
    task_type: '',
    activity_id: activities[0]?.id ?? '',
    status: 'open',
    assignee_1_id: '',
    assignee_2_id: '',
    due_date: '',
  })
  const [users, setUsers] = useState([])
  const [taskTypes, setTaskTypes] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title,
        description: task.description ?? '',
        task_type: task.task_type ?? '',
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
    fetch(`/api/task-types?event_id=${eventId}`)
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d) ? d : []
        setTaskTypes(list)
        if (!task && list.length > 0) {
          setForm((f) => ({ ...f, task_type: list[0].name }))
        }
      })
      .catch(() => {})
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
      description: form.description || null,
      task_type: form.task_type || null,
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
      setError(d.error ?? t(lang, 'Save failed', '儲存失敗'))
    }
    setSaving(false)
  }

  const inputCls = 'w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400'

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-lg max-h-[90vh] overflow-y-auto">
        <h2 className="font-semibold text-gray-900 mb-4">
          {isEdit ? t(lang, 'Edit Task', '編輯任務') : t(lang, 'New Task', '新增任務')}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t(lang, 'Title', '標題')}</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">{t(lang, 'Description', '任務描述')}</label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              placeholder={t(lang, 'Enter task description (optional)', '請輸入任務說明（選填）')}
              className={`${inputCls} resize-none`}
            />
          </div>

          {taskTypes.length > 0 && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t(lang, 'Task Type', '任務類型')}</label>
              <select
                value={form.task_type}
                onChange={(e) => set('task_type', e.target.value)}
                className={inputCls}
              >
                <option value="">{t(lang, 'None', '不指定')}</option>
                {taskTypes.map((tt) => (
                  <option key={tt.id} value={tt.name}>{tt.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-500 mb-1">{t(lang, 'Activity', '活動')}</label>
            <select
              value={form.activity_id}
              onChange={(e) => set('activity_id', e.target.value)}
              required
              className={inputCls}
            >
              <option value="">{t(lang, 'Select activity…', '選擇活動…')}</option>
              {activities.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">{t(lang, 'Status', '狀態')}</label>
            <select value={form.status} onChange={(e) => set('status', e.target.value)} className={inputCls}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">{t(lang, 'Assignee 1', '負責人一')}</label>
            <select
              value={form.assignee_1_id}
              onChange={(e) => set('assignee_1_id', e.target.value)}
              required
              className={inputCls}
            >
              <option value="">{t(lang, 'Select assignee…', '選擇負責人…')}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">{t(lang, 'Assignee 2 (optional)', '負責人二（選填）')}</label>
            <select
              value={form.assignee_2_id}
              onChange={(e) => set('assignee_2_id', e.target.value)}
              className={inputCls}
            >
              <option value="">{t(lang, 'None', '無')}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">{t(lang, 'Due Date', '到期日')}</label>
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
                {t(lang, 'Delete Task', '刪除任務')}
              </button>
            )}
            <div className="flex gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                {t(lang, 'Cancel', '取消')}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? t(lang, 'Saving…', '儲存中…') : t(lang, 'Save', '儲存')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
