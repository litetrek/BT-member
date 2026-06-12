import { useState, useEffect } from 'react'
import IconPicker from './IconPicker'

export default function ActivityForm({ eventId, activity, onClose, onSaved }) {
  const isEdit = !!activity

  const [form, setForm] = useState({
    name: '',
    icon: 'ti-star',
    lead_id: '',
    co_lead_id: '',
  })
  const [users, setUsers] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (activity) {
      setForm({
        name: activity.name,
        icon: activity.icon,
        lead_id: activity.lead_id,
        co_lead_id: activity.co_lead_id ?? '',
      })
    }
  }, [activity])

  useEffect(() => {
    fetch(`/api/users?event_id=${eventId}`)
      .then((r) => r.json())
      .then((d) => setUsers(Array.isArray(d) ? d : []))
      .catch(() => setUsers([]))
  }, [eventId])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const url = isEdit ? `/api/activities/${activity.id}` : '/api/activities'
    const method = isEdit ? 'PUT' : 'POST'
    const body = { ...form, event_id: eventId, co_lead_id: form.co_lead_id || null }

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      onSaved()
    } else {
      const d = await res.json()
      setError(d.error ?? '儲存失敗')
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-lg">
        <h2 className="font-semibold text-gray-900 mb-4">
          {isEdit ? '編輯活動' : '新增活動'}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">名稱</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">圖示</label>
            <IconPicker value={form.icon} onChange={(v) => setForm({ ...form, icon: v })} />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">負責人</label>
            <select
              required
              value={form.lead_id}
              onChange={(e) => setForm({ ...form, lead_id: e.target.value })}
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="">選擇負責人…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">協助人（選填）</label>
            <select
              value={form.co_lead_id}
              onChange={(e) => setForm({ ...form, co_lead_id: e.target.value })}
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="">無</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '儲存中…' : '儲存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
