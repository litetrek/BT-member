import { useState } from 'react'

// Turns "2027 Spring Event" into "2027-spring-event". Chinese-only names give '',
// so the admin types the code themselves.
export function suggestSlug(name) {
  return String(name)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export default function NewEventForm({ events, onCreated, onCancel }) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [eventDate, setEventDate] = useState('')
  const [copyFrom, setCopyFrom] = useState(events[0]?.id ?? '')
  const [copy, setCopy] = useState({ members: true, activities: true, task_types: true, tasks: false })
  const toggle = (k) => setCopy((c) => {
    const next = { ...c, [k]: !c[k] }
    if (k === 'activities' && !next.activities) next.tasks = false
    if (k === 'tasks' && next.tasks) next.activities = true
    return next
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function handleName(v) {
    setName(v)
    if (!slugTouched) setSlug(suggestSlug(v))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug, event_date: eventDate, copy_from: copyFrom || null, copy }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError({ message: data.error ?? '建立失敗，請稍後再試', field: data.field })
        return
      }
      onCreated(data)
    } catch {
      setError({ message: '網路錯誤，請稍後再試' })
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400'
  const errFor = (f) => error?.field === f ? 'border-red-400' : ''

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onCancel}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl p-6 shadow-lg"
      >
        <h2 className="font-semibold text-gray-900 mb-5">新增活動</h2>

        <label className="block text-sm text-gray-700 mb-1" htmlFor="ev-name">活動名稱</label>
        <input id="ev-name" className={`${inputCls} ${errFor('name')} mb-4`} value={name}
          onChange={(e) => handleName(e.target.value)} placeholder="例如：2027 Spring Event" required autoFocus />

        <label className="block text-sm text-gray-700 mb-1" htmlFor="ev-slug">網址代碼</label>
        <input id="ev-slug" className={`${inputCls} ${errFor('slug')} font-mono`} value={slug}
          onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase()) }}
          placeholder="2027-spring-event" required autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        <p className="text-xs text-gray-400 mt-1 mb-4 font-mono break-all">bt.cyber-tech.com/{slug || '…'}</p>

        <label className="block text-sm text-gray-700 mb-1" htmlFor="ev-date">活動日期</label>
        <input id="ev-date" type="date" className={`${inputCls} ${errFor('event_date')} mb-4`} value={eventDate}
          onChange={(e) => setEventDate(e.target.value)} required />

        {events.length > 0 && (
          <>
            <label className="block text-sm text-gray-700 mb-1" htmlFor="ev-copy">從以前的活動複製架構</label>
            <select id="ev-copy" className={`${inputCls} mb-3 bg-white`} value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
              {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
              <option value="">不複製，從空白開始</option>
            </select>
            {copyFrom && (
              <div className="flex flex-col gap-2 mb-3 pl-1">
                {[
                  ['members',    '團隊成員和角色'],
                  ['activities', '活動項目和負責人'],
                  ['task_types', '任務類型'],
                  ['tasks',      '任務清單（狀態重設為未開始，到期日依新活動日期順延）'],
                ].map(([k, label]) => (
                  <label key={k} className="flex items-start gap-2 text-sm text-gray-700">
                    <input type="checkbox" className="w-4 h-4 mt-0.5 accent-blue-600" checked={copy[k]} onChange={() => toggle(k)} />
                    <span>{label}</span>
                  </label>
                ))}
                <p className="text-xs text-gray-400">不會複製：狀態更新、公告和紀錄。</p>
              </div>
            )}
            <p className="text-xs text-gray-400 mb-4">您會自動成為此活動的管理員。</p>
          </>
        )}

        {error && <p className="text-sm text-red-600 mb-4">{error.message}</p>}

        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100">取消</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? '建立中…' : '建立活動'}
          </button>
        </div>
      </form>
    </div>
  )
}
