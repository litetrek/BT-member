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

const ROLE_COLORS = {
  admin: 'bg-purple-100 text-purple-700',
  lead:  'bg-blue-100 text-blue-700',
  member:'bg-gray-100 text-gray-600',
}

export default function AdminUsersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { slug } = router.query

  const [members, setMembers] = useState([])
  const [eventId, setEventId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [removeTarget, setRemoveTarget] = useState(null)
  const [updatingRole, setUpdatingRole] = useState(null)

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

  async function handleRoleChange(userId, newRole) {
    setUpdatingRole(userId)
    await fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole, event_id: eventId }),
    })
    setUpdatingRole(null)
    loadMembers(eventId)
  }

  async function handleRemove(userId) {
    await fetch(`/api/users/${userId}?event_id=${eventId}`, { method: 'DELETE' })
    setRemoveTarget(null)
    loadMembers(eventId)
  }

  const active  = members.filter((m) => m.status === 'active')
  const pending = members.filter((m) => m.status === 'invited')

  const selectCls = 'border border-gray-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400'

  return (
    <>
      <Head><title>Team · {slug}</title></Head>
      <Layout slug={slug} activePage="users" user={session?.user} userRole={userRole}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold text-gray-900">Team Members</h1>
          <button
            onClick={() => setShowInvite(true)}
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
          >
            + Invite
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
                      <select
                        value={m.role}
                        disabled={updatingRole === m.id || m.id === session?.user?.id}
                        onChange={(e) => handleRoleChange(m.id, e.target.value)}
                        className={selectCls}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                        Active
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {m.id !== session?.user?.id && (
                        <button
                          onClick={() => setRemoveTarget(m)}
                          className="text-gray-400 hover:text-red-500"
                          title="Remove member"
                        >
                          <span className="ti ti-trash text-sm" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}

                {pending.length > 0 && (
                  <>
                    <tr>
                      <td colSpan={5} className="px-4 py-2 bg-gray-50">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Pending Invites
                        </span>
                      </td>
                    </tr>
                    {pending.map((m) => (
                      <tr key={m.id} className="hover:bg-gray-50 opacity-70">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Avatar name={m.email} avatarUrl={null} size="sm" />
                            <span className="text-gray-400 italic text-sm">Invited</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{m.email}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[m.role] ?? ROLE_COLORS.member}`}>
                            {m.role.charAt(0).toUpperCase() + m.role.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                            Invited
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setRemoveTarget(m)}
                            className="text-gray-400 hover:text-red-500"
                            title="Cancel invite"
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

      {showInvite && eventId && (
        <InviteForm
          eventId={eventId}
          onClose={() => setShowInvite(false)}
          onSaved={() => { setShowInvite(false); loadMembers(eventId) }}
        />
      )}

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
