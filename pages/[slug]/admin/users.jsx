import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Layout from '@/components/Layout'
import Avatar from '@/components/Avatar'
import InviteForm from '@/components/InviteForm'
import ConfirmDialog from '@/components/ConfirmDialog'
import Spinner from '@/components/Spinner'

const ROLES = ['admin', 'lead', 'member']

export default function AdminUsersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { slug } = router.query

  const [members, setMembers] = useState([])
  const [eventId, setEventId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [removeTarget, setRemoveTarget] = useState(null)
  const [editTarget, setEditTarget] = useState(null)   // { id, name, role, email }
  const [editForm, setEditForm] = useState({ name: '', role: 'member' })
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const userRole = session?.user?.role

  useEffect(() => {
    if (status === 'unauthenticated') router.replace(`/${slug}`)
    if (status === 'authenticated' && userRole && userRole !== 'admin') {
      router.replace(`/${slug}/dashboard`)
    }
  }, [status, userRole, slug])

  useEffect(() => {
    if (!slug) return
    fetch('/api/events')
      .then((r) => r.json())
      .then((events) => {
        const ev = (events ?? []).find((e) => e.slug === slug)
        if (ev) setEventId(ev.id)
      })
      .catch(() => {})
  }, [slug])

  function loadMembers(eid) {
    fetch(`/api/users?event_id=${eid}`)
      .then((r) => r.json())
      .then((d) => { setMembers(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    if (eventId) loadMembers(eventId)
  }, [eventId])

  function openEdit(m) {
    setEditTarget(m)
    setEditForm({ name: m.name ?? '', role: m.role })
    setEditError('')
  }

  async function handleSaveEdit() {
    setSaving(true)
    setEditError('')
    const res = await fetch(`/api/users/${editTarget.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editForm.name, role: editForm.role, event_id: eventId }),
    })
    if (res.ok) {
      setEditTarget(null)
      loadMembers(eventId)
    } else {
      const d = await res.json().catch(() => ({}))
      setEditError(d.error ?? 'Save failed')
    }
    setSaving(false)
  }

  async function handleRemove(userId) {
    await fetch(`/api/users/${userId}?event_id=${eventId}`, { method: 'DELETE' })
    setRemoveTarget(null)
    loadMembers(eventId)
  }

  const active  = members.filter((m) => m.status === 'active')
  const pending = members.filter((m) => m.status === 'invited')

  const inputCls = 'w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400'

  return (
    <>
      <Head><title>Team · {slug}</title></Head>
      <Layout slug={slug} activePage="users" user={session?.user} userRole={userRole}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold text-gray-900">Team Members</h1>
          <button
            onClick={() => setShowAdd(true)}
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
          >
            + Add Member
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : active.length === 0 && pending.length === 0 ? (
          <p className="text-sm text-gray-400">No team members yet.</p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Member</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {active.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={m.name ?? m.email} avatarUrl={m.avatar_url} size="sm" />
                        <span className="text-gray-800">{m.name ?? '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{m.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        m.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                        m.role === 'lead'  ? 'bg-blue-100 text-blue-700' :
                                             'bg-gray-100 text-gray-600'
                      }`}>
                        {m.role.charAt(0).toUpperCase() + m.role.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                        Active
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(m)}
                          className="text-gray-400 hover:text-blue-500"
                          title="Edit member"
                        >
                          <span className="ti ti-pencil text-sm" />
                        </button>
                        {m.id !== session?.user?.id && (
                          <button
                            onClick={() => setRemoveTarget(m)}
                            className="text-gray-400 hover:text-red-500"
                            title="Remove member"
                          >
                            <span className="ti ti-trash text-sm" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {pending.length > 0 && (
                  <>
                    <tr>
                      <td colSpan={5} className="px-4 py-2 bg-gray-50">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Not yet signed in
                        </span>
                      </td>
                    </tr>
                    {pending.map((m) => (
                      <tr key={m.id} className="hover:bg-gray-50 opacity-70">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Avatar name={m.email} avatarUrl={null} size="sm" />
                            <span className="text-gray-400 italic text-sm">—</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{m.email}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            m.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                            m.role === 'lead'  ? 'bg-blue-100 text-blue-700' :
                                                 'bg-gray-100 text-gray-600'
                          }`}>
                            {m.role.charAt(0).toUpperCase() + m.role.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                            Pending
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setRemoveTarget(m)}
                            className="text-gray-400 hover:text-red-500"
                            title="Remove"
                          >
                            <span className="ti ti-trash text-sm" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Layout>

      {/* Add Member modal */}
      {showAdd && eventId && (
        <InviteForm
          eventId={eventId}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); loadMembers(eventId) }}
        />
      )}

      {/* Edit modal */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-lg">
            <h2 className="font-semibold text-gray-900 mb-4">Edit Member</h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Email</label>
                <p className="text-sm text-gray-400 px-3 py-2 bg-gray-50 rounded border border-gray-100">
                  {editTarget.email}
                </p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                  className={inputCls}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                  ))}
                </select>
              </div>
              {editError && <p className="text-xs text-red-500">{editError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setEditTarget(null)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Remove confirm */}
      {removeTarget && (
        <ConfirmDialog
          message={`Remove ${removeTarget.name ?? removeTarget.email} from this event?`}
          confirmLabel="Remove"
          onConfirm={() => handleRemove(removeTarget.id)}
          onCancel={() => setRemoveTarget(null)}
        />
      )}
    </>
  )
}
