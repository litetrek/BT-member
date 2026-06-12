import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Layout from '@/components/Layout'
import StatusBadge from '@/components/StatusBadge'
import AISummary from '@/components/AISummary'
import AIChat from '@/components/AIChat'
import Link from 'next/link'

function StatCard({ label, value, color }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${color ?? 'text-gray-900'}`}>{value}</p>
    </div>
  )
}

export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { slug } = router.query

  const [activities, setActivities] = useState([])
  const [myTasks, setMyTasks] = useState([])
  const [eventId, setEventId] = useState(null)
  const [loading, setLoading] = useState(true)

  const userRole = session?.user?.role

  useEffect(() => {
    if (status === 'unauthenticated') router.replace(`/${slug}`)
  }, [status, slug])

  useEffect(() => {
    if (!slug || status !== 'authenticated') return

    fetch(`/api/activities?slug=${slug}`)
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d) ? d : []
        setActivities(list)
        if (list[0]?.event_id) setEventId(list[0].event_id)
      })
      .catch(() => setActivities([]))

    fetch(`/api/tasks?slug=${slug}`)
      .then((r) => r.json())
      .then((tasks) => {
        const list = Array.isArray(tasks) ? tasks : []
        setMyTasks(
          list.filter(
            (t) =>
              t.assignee_1_id === session.user.id ||
              t.assignee_2_id === session.user.id
          )
        )
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [slug, status, session])

  // Fallback: get eventId from /api/events if activities didn't provide it
  useEffect(() => {
    if (!slug || eventId) return
    fetch('/api/events')
      .then((r) => r.json())
      .then((events) => {
        const ev = (events ?? []).find((e) => e.slug === slug)
        if (ev) setEventId(ev.id)
      })
      .catch(() => {})
  }, [slug, eventId])

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const allTasks = activities.flatMap((a) => a.tasks ?? [])
  const stats = {
    total:       allTasks.length,
    done:        allTasks.filter((t) => t.status === 'done').length,
    in_progress: allTasks.filter((t) => t.status === 'in_progress').length,
    overdue:     allTasks.filter((t) => t.status !== 'done' && t.due_date && new Date(t.due_date) < today).length,
  }

  const canSeeAI = ['admin', 'lead'].includes(userRole)

  return (
    <>
      <Head><title>總覽 · {slug}</title></Head>
      <Layout slug={slug} activePage="dashboard" user={session?.user} userRole={userRole}>
        <h1 className="text-lg font-semibold text-gray-900 mb-6">總覽</h1>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
          <StatCard label="總任務"  value={stats.total}       />
          <StatCard label="已完成"  value={stats.done}        color="text-green-600" />
          <StatCard label="進行中"  value={stats.in_progress} color="text-amber-600" />
          <StatCard label="逾期"    value={stats.overdue}     color="text-red-600" />
        </div>

        {/* AI Summary + Chat — admin/lead only */}
        {canSeeAI && eventId && (
          <div className="mb-8 flex flex-col gap-4">
            <AISummary eventId={eventId} />
            <AIChat eventId={eventId} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {/* My Tasks */}
          <section>
            <h2 className="text-sm font-medium text-gray-700 mb-3">我的任務</h2>
            {myTasks.length === 0 ? (
              <p className="text-sm text-gray-400">目前沒有指派給您的任務。</p>
            ) : (
              <div className="flex flex-col gap-2">
                {myTasks.map((t) => (
                  <div key={t.id} className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between gap-2">
                    <span className="text-sm text-gray-800 truncate">{t.title}</span>
                    <StatusBadge status={t.status} dueDate={t.due_date} />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Activity Progress */}
          <section>
            <h2 className="text-sm font-medium text-gray-700 mb-3">
              <Link href={`/${slug}/activities`} className="hover:text-blue-600">
                活動進度 →
              </Link>
            </h2>
            {activities.length === 0 ? (
              <p className="text-sm text-gray-400">尚無活動。</p>
            ) : (
              <div className="flex flex-col gap-3">
                {activities.map((a) => {
                  const tasks = a.tasks ?? []
                  const done  = tasks.filter((t) => t.status === 'done').length
                  const pct   = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0
                  return (
                    <div key={a.id} className="bg-white border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`ti ${a.icon} text-blue-500 shrink-0`} />
                        <span className="text-sm text-gray-800 truncate">{a.name}</span>
                        <span className="ml-auto text-xs text-gray-400 shrink-0">{pct}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </Layout>
    </>
  )
}
