import { useState } from 'react'
import { t } from '@/lib/i18n'

export default function InviteForm({ eventId, onClose, onSaved, lang = 'zh' }) {
  const ROLES = [
    { value: 'member', label: t(lang, 'Member',    '一般成員') },
    { value: 'lead',   label: t(lang, 'Lead',      '負責人') },
    { value: 'admin',  label: t(lang, 'Admin',     '管理員') },
  ]

  const [form, setForm] = useState({ name: '', email: '', role: 'member' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const res = await fetch('/api/users/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, event_id: eventId }),
    })

    if (res.ok) {
      onSaved()
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? t(lang, 'Add failed', '新增失敗'))
    }
    setSaving(false)
  }

  const inputCls = 'w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400'

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-lg">
        <h2 className="font-semibold text-gray-900 mb-4">{t(lang, 'Add Member', '新增成員')}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t(lang, 'Name', '姓名')}</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder={t(lang, 'Full name', '全名')}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">{t(lang, 'Email', '電子郵件')}</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="email@example.com"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">{t(lang, 'Role', '角色')}</label>
            <select
              value={form.role}
              onChange={(e) => set('role', e.target.value)}
              className={inputCls}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
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
              {t(lang, 'Cancel', '取消')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? t(lang, 'Adding…', '新增中…') : t(lang, 'Add Member', '新增成員')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
