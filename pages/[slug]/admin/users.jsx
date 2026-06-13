import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Layout from '@/components/Layout'
import Avatar from '@/components/Avatar'
import InviteForm from '@/components/InviteForm'
import ConfirmDialog from '@/components/ConfirmDialog'
import Spinner from '@/components/Spinner'
import { useLang } from '@/lib/useLang'
import { t } from '@/lib/i18n'

const DEFAULT_TYPE_NAMES = ['一般', '採購', '聯絡溝通', '現場工作']

export default function AdminUsersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { slug } = router.query
  const [lang, updateLang] = useLang()

  const ROLES = ['admin', 'lead', 'member']
  const ROLE_LABELS = {
    admin:  t(lang, 'Admin',  '管理員'),
    lead:   t(lang, 'Lead',   '負責人'),
    member: t(lang, 'Member', '一般成員'),
  }

  const [members, setMembers] = useState([])
  const [eventId, setEventId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [removeTarget, setRemoveTarget] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', role: 'member' })
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const [taskTypes, setTaskTypes] = useState([])
  const [newTypeName, setNewTypeName] = useState('')
  const [addingType, setAddingType] = useState(false)
  const [typeError, setTypeError] = useState('')

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
    if (eventId) {
      loadMembers(eventId)
      loadTaskTypes(eventId)
    }
  }, [eventId])

  function loadTaskTypes(eid) {
    fetch(`/api/task-types?event_id=${eid}`)
      .then((r) => r.json())
      .then((d) => setTaskTypes(Array.isArray(d) ? d : []))
      .catch(() => {})
  }

  async function handleAddType(e) {
    e.preventDefault()
    const name = newTypeName.trim()
    if (!name || !eventId) return
    setAddingType(true)
    setTypeError('')
    const res = await fetch(`/api/task-types?event_id=${eventId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (res.ok) {
      setNewTypeName('')
      loadTaskTypes(eventId)
    } else {
      const d = await res.json().catch(() => ({}))
      setTypeError(d.error ?? t(lang, 'Add failed', '新增失敗'))
    }
    setAddingType(false)
  }

  async function handleDeleteType(id, name) {
    if (DEFAULT_TYPE_NAMES.includes(name)) return
    if (!confirm(t(lang, `Delete type "${name}"?`, `確定要刪除「${name}」類型嗎？`))) return
    const res = await fetch(`/api/task-types/${id}`, { method: 'DELETE' })
    if (res.ok) loadTaskTypes(eventId)
  }

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
      setEditError(d.error ?? t(lang, 'Save failed', '儲存失敗'))
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
      <Head><title>{t(lang, 'Team', '團隊')} · {slug}</title></Head>
      <Layout slug={slug} activePage="users" user={session?.user} userRole={userRole} lang={lang} onLangChange={updateLang}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold text-gray-900">{t(lang, 'Team Members', '團隊成員')}</h1>
          <button
            onClick={() => setShowAdd(true)}
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
          >
            + {t(lang, 'Add Member', '新增成員')}
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : active.length === 0 && pending.length === 0 ? (
          <p className="text-sm text-gray-400">{t(lang, 'No team members yet.', '尚無團隊成員。')}</p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t(lang, 'Member', '成員')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t(lang, 'Email', '電子郵件')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t(lang, 'Role', '角色')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">{t(lang, 'Status', '狀態')}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {active.map((m) => (
                  <tr key={m.id} onClick={() => openEdit(m)} className="hover:bg-gray-50 cursor-pointer">
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
                        {ROLE_LABELS[m.role] ?? m.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                        {t(lang, 'Active', '活躍')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {m.id !== session?.user?.id && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setRemoveTarget(m) }}
                            className="text-gray-400 hover:text-red-500"
                            title={t(lang, 'Remove member', '移除成員')}
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
                          {t(lang, 'Not Yet Signed In', '尚未登入')}
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
                            {ROLE_LABELS[m.role] ?? m.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                            {t(lang, 'Pending', '待確認')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setRemoveTarget(m)}
                            className="text-gray-400 hover:text-red-500"
                            title={t(lang, 'Remove', '移除')}
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

        {/* Task Type Management */}
        <section className="mt-10">
          <h2 className="text-base font-semibold text-gray-900 mb-4">{t(lang, 'Task Type Management', '任務類型管理')}</h2>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4">
            {taskTypes.length === 0 ? (
              <p className="text-sm text-gray-400 px-4 py-3">{t(lang, 'No types yet.', '尚無類型。')}</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {taskTypes.map((tt) => {
                  const isDefault = DEFAULT_TYPE_NAMES.includes(tt.name)
                  return (
                    <li key={tt.id} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-sm text-gray-800">{tt.name}</span>
                      {isDefault ? (
                        <span className="text-xs text-gray-400">{t(lang, 'Default', '預設')}</span>
                      ) : (
                        <button
                          onClick={() => handleDeleteType(tt.id, tt.name)}
                          className="text-gray-400 hover:text-red-500 text-xs"
                          title={t(lang, 'Delete type', '刪除類型')}
                        >
                          <span className="ti ti-trash text-sm" />
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <form onSubmit={handleAddType} className="flex gap-2 items-center">
            <input
              type="text"
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              placeholder={t(lang, 'New type name', '新類型名稱')}
              className="flex-1 border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <button
              type="submit"
              disabled={addingType || !newTypeName.trim()}
              className="text-sm bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 disabled:opacity-50 shrink-0"
            >
              + {t(lang, 'Add Type', '新增類型')}
            </button>
          </form>
          {typeError && <p className="text-xs text-red-500 mt-1">{typeError}</p>}
        </section>
      </Layout>

      {/* Add Member modal */}
      {showAdd && eventId && (
        <InviteForm
          eventId={eventId}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); loadMembers(eventId) }}
          lang={lang}
        />
      )}

      {/* Edit modal */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-lg">
            <h2 className="font-semibold text-gray-900 mb-4">{t(lang, 'Edit Member', '編輯成員')}</h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t(lang, 'Email', '電子郵件')}</label>
                <p className="text-sm text-gray-400 px-3 py-2 bg-gray-50 rounded border border-gray-100">
                  {editTarget.email}
                </p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t(lang, 'Name', '姓名')}</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t(lang, 'Role', '角色')}</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                  className={inputCls}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              {editError && <p className="text-xs text-red-500">{editError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setEditTarget(null)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  {t(lang, 'Cancel', '取消')}
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? t(lang, 'Saving…', '儲存中…') : t(lang, 'Save', '儲存')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Remove confirm */}
      {removeTarget && (
        <ConfirmDialog
          message={t(lang,
            `Remove ${removeTarget.name ?? removeTarget.email} from this event?`,
            `確定要從此活動移除 ${removeTarget.name ?? removeTarget.email} 嗎？`
          )}
          confirmLabel={t(lang, 'Remove', '移除')}
          onConfirm={() => handleRemove(removeTarget.id)}
          onCancel={() => setRemoveTarget(null)}
          lang={lang}
        />
      )}
    </>
  )
}
