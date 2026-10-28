import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import Head from 'next/head'
import { getInventoryRole, isInventoryAdminOfAny } from '@/lib/inventory'
import { formatDateOnly, yearOf } from '@/lib/dates'

function EventCard({ event, isAdmin, onToggleStatus }) {
  const isActive = event.status === 'active'
  const dateStr = formatDateOnly(event.event_date, 'zh-TW')
  const [saving, setSaving] = useState(false)

  async function handleToggle(e) {
    e.preventDefault()
    e.stopPropagation()
    const next = isActive ? 'archived' : 'active'
    const msg = isActive ? `將「${event.name}」標記為已結束？` : `將「${event.name}」重新開啟為進行中？`
    if (!confirm(msg)) return
    setSaving(true)
    try { await onToggleStatus(event, next) } finally { setSaving(false) }
  }

  return (
    <Link href={`/${event.slug}`}>
      <div
        className={`bg-white rounded-lg border p-5 cursor-pointer hover:shadow-sm transition-shadow ${
          isActive ? 'border-blue-400 ring-1 ring-blue-400' : 'border-gray-200'
        }`}
      >
        <div className="flex items-start justify-between mb-3">
          <span className="text-xs text-gray-400">
            {yearOf(event.event_date)}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded font-medium ${
              isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {isActive ? '進行中' : '已結束'}
          </span>
        </div>
        <h2 className="font-semibold text-gray-900 text-sm mb-1">{event.name}</h2>
        <p className="text-xs text-gray-500 mb-3">{dateStr}</p>
        <p className="text-xs text-gray-400 font-mono">
          bt.cyber-tech.com/{event.slug}
        </p>
        {isAdmin && (
          <button
            onClick={handleToggle}
            disabled={saving}
            className="mt-3 text-xs text-gray-500 border border-gray-200 rounded px-2 py-1 hover:bg-gray-50 disabled:opacity-50"
          >
            {saving ? '儲存中…' : isActive ? '標記為已結束' : '重新開啟'}
          </button>
        )}
      </div>
    </Link>
  )
}

export default function Home() {
  const { data: session } = useSession()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const inventoryRole = getInventoryRole(session)
  const canManageUsers = session?.user?.role === 'admin' || isInventoryAdminOfAny(session)
  const isAdmin = session?.user?.role === 'admin'

  async function toggleStatus(event, status) {
    const res = await fetch(`/api/events/${event.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) { alert('更新失敗，請稍後再試。'); return }
    const updated = await res.json()
    setEvents((list) => list.map((e) => (e.id === updated.id ? { ...e, status: updated.status } : e)))
  }

  useEffect(() => {
    fetch('/api/events')
      .then((r) => r.json())
      .then((d) => { setEvents(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <>
      <Head><title>聖天湖佛教城</title></Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="font-semibold text-gray-900">聖天湖佛教城</h1>
              <p className="text-xs text-gray-500">bt.cyber-tech.com</p>
            </div>
            {session?.user?.role === 'admin' && (
              <button className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">
                + 新增活動
              </button>
            )}
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-10">
          {loading ? (
            <p className="text-sm text-gray-400">載入中…</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-gray-400">尚無活動。</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {events.map((e) => <EventCard key={e.id} event={e} isAdmin={isAdmin} onToggleStatus={toggleStatus} />)}
            </div>
          )}

          {(inventoryRole || canManageUsers) && (
            <div className="mt-10 flex flex-wrap gap-4">
              {inventoryRole && (
                <div>
                  <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">庫存管理</h2>
                  <Link href="/inventory">
                    <div className="bg-white rounded-lg border border-gray-200 p-5 cursor-pointer hover:shadow-sm hover:border-blue-400 transition-all w-72">
                      <h3 className="font-semibold text-gray-900 text-sm mb-1">庫存管理</h3>
                      <p className="text-xs text-gray-400">Inventory Control</p>
                    </div>
                  </Link>
                </div>
              )}
              {canManageUsers && (
                <div>
                  <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">管理</h2>
                  <Link href="/admin/users">
                    <div className="bg-white rounded-lg border border-gray-200 p-5 cursor-pointer hover:shadow-sm hover:border-blue-400 transition-all w-72">
                      <h3 className="font-semibold text-gray-900 text-sm mb-1">使用者管理</h3>
                      <p className="text-xs text-gray-400">User Management</p>
                    </div>
                  </Link>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </>
  )
}
