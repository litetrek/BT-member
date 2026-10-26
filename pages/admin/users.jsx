import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import Avatar from '@/components/Avatar'
import Spinner from '@/components/Spinner'
import { getInventoryRole, INVENTORY_MODULES } from '@/lib/inventory'

const EVENT_ROLES = ['admin', 'lead', 'member']
const MODULE_ROLES = ['admin', 'editor', 'viewer']

export default function AdminUsers() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const isEventAdmin = session?.user?.role === 'admin'
  const adminModules = useMemo(
    () => INVENTORY_MODULES.filter((m) => getInventoryRole(session, m.key) === 'admin'),
    [session]
  )
  const canUse = isEventAdmin || adminModules.length > 0

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newRow, setNewRow] = useState({ email: '', name: '' })
  const [busyKey, setBusyKey] = useState('') // which cell is mid-request, "email:column"

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/')
    if (status === 'authenticated' && !canUse) router.replace('/')
  }, [status, canUse])

  function load() {
    setLoading(true)
    fetch('/api/admin/users')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    if (status === 'authenticated' && canUse) load()
  }, [status, canUse])

  if (status !== 'authenticated' || !canUse) return null

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center pt-24"><Spinner /></div>
    )
  }

  const { users, events, eventMembers, moduleAccess } = data

  const eventRoleFor = (userId, eventId) =>
    eventMembers.find((m) => m.user_id === userId && m.event_id === eventId)?.role ?? ''
  const moduleRoleFor = (email, moduleKey) =>
    moduleAccess.find((m) => m.email?.toLowerCase() === email?.toLowerCase() && m.module_key === moduleKey)?.role ?? ''

  async function setEventRole(userId, email, name, eventId, role) {
    const key = `${email}:event:${eventId}`
    setBusyKey(key)
    setError('')
    try {
      if (!role) {
        await fetch(`/api/users/${userId}?event_id=${eventId}`, { method: 'DELETE' })
      } else if (eventMembers.some((m) => m.user_id === userId && m.event_id === eventId)) {
        await fetch(`/api/users/${userId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role, event_id: eventId }),
        })
      } else {
        const res = await fetch('/api/users/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, name: name || undefined, role, event_id: eventId }),
        })
        if (!res.ok) throw new Error((await res.json()).error || '操作失敗')
      }
      load()
      setNewRow({ email: '', name: '' })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyKey('')
    }
  }

  async function setModuleRole(email, moduleKey, role) {
    const key = `${email}:module:${moduleKey}`
    setBusyKey(key)
    setError('')
    try {
      if (!role) {
        await fetch(`/api/admin/inventory-access?email=${encodeURIComponent(email)}&module_key=${moduleKey}`, { method: 'DELETE' })
      } else {
        const res = await fetch('/api/admin/inventory-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, module_key: moduleKey, role }),
        })
        if (!res.ok) throw new Error((await res.json()).error || '操作失敗')
      }
      load()
      setNewRow({ email: '', name: '' })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyKey('')
    }
  }

  const selectCls = 'border border-gray-200 rounded px-1.5 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400'

  function EventCell({ user }) {
    return (events.map((ev) => {
      const canEdit = isEventAdmin
      const role = eventRoleFor(user.id, ev.id)
      const key = `${user.email}:event:${ev.id}`
      return (
        <td key={ev.id} className="px-3 py-2 text-center">
          {canEdit ? (
            <select
              value={role}
              disabled={busyKey === key}
              onChange={(e) => setEventRole(user.id, user.email, user.name, ev.id, e.target.value)}
              className={selectCls}
            >
              <option value="">—</option>
              {EVENT_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          ) : (
            <span className="text-sm text-gray-500">{role || '—'}</span>
          )}
        </td>
      )
    }))
  }

  function ModuleCell({ email }) {
    return (INVENTORY_MODULES.map((m) => {
      const canEdit = adminModules.some((am) => am.key === m.key)
      const role = moduleRoleFor(email, m.key)
      const key = `${email}:module:${m.key}`
      return (
        <td key={m.key} className="px-3 py-2 text-center">
          {canEdit ? (
            <select
              value={role}
              disabled={busyKey === key || !email}
              onChange={(e) => setModuleRole(email, m.key, e.target.value)}
              className={selectCls}
            >
              <option value="">—</option>
              {MODULE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          ) : (
            <span className="text-sm text-gray-500">{role || '—'}</span>
          )}
        </td>
      )
    }))
  }

  return (
    <>
      <Head><title>使用者管理 · 聖天湖佛教城</title></Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-gray-700 text-base">← 首頁</Link>
            <div>
              <h1 className="font-semibold text-gray-900">使用者管理</h1>
              <p className="text-sm text-gray-500">User Management — Events &amp; Inventory Control</p>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-8">
          <p className="text-sm text-gray-400 mb-4">
            每個欄位可直接設定角色；選擇「—」即移除存取權。您只能編輯自己是管理員的活動或模組欄位。
          </p>
          {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

          <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-gray-500">
                  <th className="px-3 py-2 text-left font-medium sticky left-0 bg-gray-50">使用者</th>
                  {events.map((ev) => (
                    <th key={ev.id} className="px-3 py-2 text-center font-medium whitespace-nowrap">{ev.name}</th>
                  ))}
                  {INVENTORY_MODULES.map((m) => (
                    <th key={m.key} className="px-3 py-2 text-center font-medium whitespace-nowrap">{m.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-3 py-2 sticky left-0 bg-white">
                      <div className="flex items-center gap-2 min-w-[180px]">
                        <Avatar name={u.name} avatarUrl={u.avatar_url} size="sm" />
                        <div className="min-w-0">
                          <p className="text-gray-900 truncate">{u.name ?? '（尚未登入）'}</p>
                          <p className="text-gray-400 text-xs truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <EventCell user={u} />
                    <ModuleCell email={u.email} />
                  </tr>
                ))}

                <tr className="bg-blue-50/40">
                  <td className="px-3 py-2 sticky left-0 bg-blue-50/40">
                    <div className="flex flex-col gap-1 min-w-[180px]">
                      <input
                        type="email"
                        placeholder="新使用者 Email"
                        value={newRow.email}
                        onChange={(e) => setNewRow((r) => ({ ...r, email: e.target.value }))}
                        className="border border-gray-200 rounded px-2 py-1 text-sm"
                      />
                      <input
                        type="text"
                        placeholder="姓名（選填）Name"
                        value={newRow.name}
                        onChange={(e) => setNewRow((r) => ({ ...r, name: e.target.value }))}
                        className="border border-gray-200 rounded px-2 py-1 text-sm"
                      />
                    </div>
                  </td>
                  {events.map((ev) => {
                    const canEdit = isEventAdmin
                    const key = `${newRow.email}:event:${ev.id}`
                    return (
                      <td key={ev.id} className="px-3 py-2 text-center">
                        {canEdit ? (
                          <select
                            value=""
                            disabled={!newRow.email || busyKey === key}
                            onChange={(e) => e.target.value && setEventRole(null, newRow.email, newRow.name, ev.id, e.target.value)}
                            className={selectCls}
                          >
                            <option value="">—</option>
                            {EVENT_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                    )
                  })}
                  {INVENTORY_MODULES.map((m) => {
                    const canEdit = adminModules.some((am) => am.key === m.key)
                    const key = `${newRow.email}:module:${m.key}`
                    return (
                      <td key={m.key} className="px-3 py-2 text-center">
                        {canEdit ? (
                          <select
                            value=""
                            disabled={!newRow.email || busyKey === key}
                            onChange={(e) => e.target.value && setModuleRole(newRow.email, m.key, e.target.value)}
                            className={selectCls}
                          >
                            <option value="">—</option>
                            {MODULE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </>
  )
}
