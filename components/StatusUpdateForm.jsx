import { useState, useEffect } from 'react'

function nowLocalDatetime() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export default function StatusUpdateForm({ eventId, activities, currentUserId, onClose, onSaved }) {
  const [members, setMembers] = useState([])
  const [form, setForm] = useState({
    message: '',
    activity_id: activities[0]?.id ?? '',
    reporter_id: currentUserId ?? '',
    reported_at: nowLocalDatetime(),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!eventId) return
    fetch(`/api/users?event_id=${eventId}`)
      .then((r) => r.json())
      .then((d) => setMembers(Array.isArray(d) ? d.filter((u) => u.status !== 'invited') : []))
      .catch(() => {})
  }, [eventId])

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.message.trim() || !form.activity_id) return
    setSaving(true)
    setError('')

    const res = await fetch('/api/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id:    eventId,
        message:     form.message.trim(),
        activity_id: form.activity_id,
        reporter_id: form.reporter_id || null,
        reported_at: form.reported_at ? new Date(form.reported_at).toISOString() : null,
      }),
    })

    if (res.ok) {
      onSaved()
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? '發佈失敗')
    }
    setSaving(false)
  }

  const inputCls = 'w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400'

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-lg max-h-[90vh] overflow-y-auto">
        <h2 className="font-semibold text-gray-900 mb-4">新增狀態更新</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          <div>
            <label className="block text-xs text-gray-500 mb-1">狀態更新內容</label>
            <textarea
              required
              rows={4}
              value={form.message}
              onChange={(e) => set('message', e.target.value)}
              placeholder="請輸入狀態更新…"
              className={`${inputCls} resize-none`}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">相關活動</label>
            <select
              required
              value={form.activity_id}
              onChange={(e) => set('activity_id', e.target.value)}
              className={inputCls}
            >
              <option value="">選擇活動…</option>
              {activities.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">回報人</label>
            <select
              value={form.reporter_id}
              onChange={(e) => set('reporter_id', e.target.value)}
              className={inputCls}
            >
              <option value="">不指定</option>
              {members.map((u) => (
                <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">回報時間</label>
            <input
              type="datetime-local"
              value={form.reported_at}
              onChange={(e) => set('reported_at', e.target.value)}
              className={inputCls}
            />
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
              disabled={saving || !form.message.trim() || !form.activity_id}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '發佈中…' : '發佈'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
