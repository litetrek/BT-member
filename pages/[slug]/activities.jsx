import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Layout from '@/components/Layout'
import ActivityCard from '@/components/ActivityCard'
import ActivityForm from '@/components/ActivityForm'
import StatusUpdateForm from '@/components/StatusUpdateForm'
import Avatar from '@/components/Avatar'

function formatDateZh(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleString('zh-TW', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function ActivitiesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { slug } = router.query

  const [activities, setActivities] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [eventId, setEventId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editActivity, setEditActivity] = useState(null)
  const [showStatusForm, setShowStatusForm] = useState(false)
  const [selectedActivityId, setSelectedActivityId] = useState(null)

  const isAdmin = session?.user?.role === 'admin'
  const canPost = ['admin', 'lead'].includes(session?.user?.role)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace(`/${slug}`)
  }, [status, slug])

  function load() {
    if (!slug) return
    fetch(`/api/activities?slug=${slug}`)
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d) ? d : []
        setActivities(list)
        if (list[0]?.event_id) setEventId(list[0].event_id)
      })
      .catch(() => setActivities([]))
  }

  function loadAnnouncements(eid) {
    if (!eid) return
    fetch(`/api/announcements?event_id=${eid}`)
      .then((r) => r.json())
      .then((d) => setAnnouncements(Array.isArray(d) ? d : []))
  }

  useEffect(() => {
    if (slug && status === 'authenticated') {
      fetch('/api/events')
        .then((r) => r.json())
        .then((events) => {
          const ev = (events ?? []).find((e) => e.slug === slug)
          if (ev) {
            setEventId(ev.id)
            loadAnnouncements(ev.id)
          }
        })
      load()
    }
  }, [slug, status])

  async function handleDelete(id) {
    if (!confirm('確定要刪除此活動嗎？')) return
    await fetch(`/api/activities/${id}`, { method: 'DELETE' })
    load()
  }

  function handleActivityClick(activityId) {
    setSelectedActivityId((prev) => prev === activityId ? null : activityId)
  }

  const selectedActivity = activities.find((a) => a.id === selectedActivityId)

  const visibleAnnouncements = selectedActivityId
    ? announcements.filter((a) => a.activity_id === selectedActivityId)
    : announcements

  return (
    <>
      <Head><title>活動 · {slug}</title></Head>
      <Layout slug={slug} activePage="activities" user={session?.user} userRole={session?.user?.role}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold text-gray-900">活動</h1>
          {isAdmin && (
            <button
              onClick={() => { setEditActivity(null); setShowForm(true) }}
              className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
            >
              + 新增活動
            </button>
          )}
        </div>

        {activities.length === 0 ? (
          <p className="text-sm text-gray-400 mb-8">尚無活動。</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            {activities.map((a) => {
              const isSelected = selectedActivityId === a.id
              return (
                <div
                  key={a.id}
                  className={`relative cursor-pointer rounded-xl transition-all ${
                    isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                  }`}
                  onClick={() => handleActivityClick(a.id)}
                >
                  {isSelected && (
                    <span className="absolute top-2 right-2 z-10 text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-full">
                      ✓ 已選取
                    </span>
                  )}
                  <ActivityCard
                    activity={a}
                    isAdmin={isAdmin}
                    onEdit={(act) => { setEditActivity(act); setShowForm(true) }}
                    onDelete={handleDelete}
                  />
                </div>
              )
            })}
          </div>
        )}

        {/* Status Updates */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-medium text-gray-700">狀態更新</h2>
              {selectedActivityId ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-blue-600">
                    顯示：{selectedActivity?.name} 的狀態更新
                  </span>
                  <button
                    onClick={() => setSelectedActivityId(null)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    × 清除篩選
                  </button>
                </div>
              ) : (
                <span className="text-xs text-gray-400">所有狀態更新</span>
              )}
            </div>
            {canPost && (
              <button
                onClick={() => setShowStatusForm(true)}
                className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
              >
                + 新增狀態更新
              </button>
            )}
          </div>

          {visibleAnnouncements.length === 0 ? (
            <p className="text-sm text-gray-400">尚無狀態更新。</p>
          ) : (
            <div className="flex flex-col gap-3">
              {visibleAnnouncements.map((a) => {
                const activityName = a.activity
                  ? a.activity.name
                  : activities.find((act) => act.id === a.activity_id)?.name

                const reporterName = a.reporter?.name ?? a.reporter?.email
                const posterName   = a.creator?.name ?? a.creator?.email
                const showOnBehalf = reporterName && posterName && a.reporter_id !== a.created_by

                return (
                  <div key={a.id} className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                    <p className="text-sm text-gray-800 mb-2">{a.message}</p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      {activityName && (
                        <button
                          onClick={() => setSelectedActivityId(
                            selectedActivityId === a.activity_id ? null : a.activity_id
                          )}
                          className="text-blue-600 hover:underline"
                        >
                          相關活動：{activityName}
                        </button>
                      )}
                      {reporterName && (
                        <span className="flex items-center gap-1">
                          <Avatar
                            name={reporterName}
                            avatarUrl={a.reporter?.avatar_url}
                            size="xs"
                          />
                          回報人：{reporterName}
                        </span>
                      )}
                      <span>
                        回報時間：{formatDateZh(a.reported_at ?? a.created_at)}
                      </span>
                      {showOnBehalf && (
                        <span className="text-gray-400 italic">
                          由 {posterName} 代為發佈
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {showForm && eventId && (
          <ActivityForm
            eventId={eventId}
            activity={editActivity}
            onClose={() => setShowForm(false)}
            onSaved={() => { setShowForm(false); load() }}
          />
        )}

        {showStatusForm && eventId && (
          <StatusUpdateForm
            eventId={eventId}
            activities={activities}
            currentUserId={session?.user?.id}
            defaultActivityId={selectedActivityId}
            onClose={() => setShowStatusForm(false)}
            onSaved={() => { setShowStatusForm(false); loadAnnouncements(eventId) }}
          />
        )}
      </Layout>
    </>
  )
}
