import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Layout from '@/components/Layout'
import StatusBadge from '@/components/StatusBadge'
import Link from 'next/link'
import { LangProvider } from '@/context/LangContext'
import { t } from '@/lib/lang'
import { isOverdue, todayISO } from '@/lib/dates'

function StatCard({ label, value, color, hint }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${color ?? 'text-gray-900'}`}>{value}</p>
      {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { slug } = router.query
  const lang = session?.user?.preferred_lang ?? 'zh'

  const [activities, setActivities] = useState([])
  const [myTasks, setMyTasks] = useState([])
  const [loadingActivities, setLoadingActivities] = useState(true)
  const [loadingTasks, setLoadingTasks] = useState(true)

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
      })
      .catch(() => setActivities([]))
      .finally(() => setLoadingActivities(false))

    fetch(`/api/tasks?slug=${slug}`)
      .then((r) => r.json())
      .then((tasks) => {
        const list = Array.isArray(tasks) ? tasks : []
        setMyTasks(
          list.filter(
            (tk) =>
              tk.assignee_1_id === session.user.id ||
              tk.assignee_2_id === session.user.id
          )
        )
      })
      .catch(() => setMyTasks([]))
      .finally(() => setLoadingTasks(false))
  }, [slug, status, session])

  // Stat cards count ALL tasks in the event (every activity), using the same overdue
  // rule as the task badges so the 逾期 card always matches the red tags below.
  const today = todayISO()
  const allTasks = activities.flatMap((a) => a.tasks ?? [])
  const stats = {
    total:       allTasks.length,
    done:        allTasks.filter((tk) => tk.status === 'done').length,
    in_progress: allTasks.filter((tk) => tk.status === 'in_progress' && !isOverdue(tk, today)).length,
    overdue:     allTasks.filter((tk) => isOverdue(tk, today)).length,
  }
  const dash = '–'
  const statValue = (n) => (loadingActivities ? dash : n)
  const allHint = t(lang, 'All tasks in this event', '本活動所有任務')

  return (
    <LangProvider lang={lang}>
      <Head><title>{t(lang, 'Overview', '總覽')} · {slug}</title></Head>
      <Layout slug={slug} activePage="dashboard" user={session?.user} userRole={userRole}>
        <h1 className="text-lg font-semibold text-gray-900 mb-6">{t(lang, 'Overview', '總覽')}</h1>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
          <StatCard label={t(lang, 'All Tasks',    '全部任務')} value={statValue(stats.total)}       hint={allHint} />
          <StatCard label={t(lang, 'Done',         '已完成')}  value={statValue(stats.done)}        color="text-green-600" hint={allHint} />
          <StatCard label={t(lang, 'In Progress',  '進行中')}  value={statValue(stats.in_progress)} color="text-amber-600" hint={allHint} />
          <StatCard label={t(lang, 'Overdue',      '逾期')}    value={statValue(stats.overdue)}     color="text-red-600" hint={allHint} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {/* My Tasks */}
          <section>
            <h2 className="text-sm font-medium text-gray-700 mb-3">
              {t(lang, 'My Tasks', '我的任務')}
              {!loadingTasks && (
                <span className="text-gray-400 font-normal">
                  {' '}{t(lang, `(${myTasks.length} of ${stats.total})`, `（${myTasks.length} / 全部 ${stats.total}）`)}
                </span>
              )}
            </h2>
            {loadingTasks ? (
              <p className="text-sm text-gray-400">{t(lang, 'Loading…', '載入中…')}</p>
            ) : myTasks.length === 0 ? (
              <p className="text-sm text-gray-400">{t(lang, 'No tasks assigned to you.', '目前沒有指派給您的任務。')}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {myTasks.map((tk) => (
                  <div key={tk.id} className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between gap-2">
                    <span className="text-sm text-gray-800 truncate">{tk.title}</span>
                    <StatusBadge status={tk.status} dueDate={tk.due_date} />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Activity Progress */}
          <section>
            <h2 className="text-sm font-medium text-gray-700 mb-3">
              <Link href={`/${slug}/activities`} className="hover:text-blue-600">
                {t(lang, 'Activity Progress →', '活動進度 →')}
              </Link>
            </h2>
            {loadingActivities ? (
              <p className="text-sm text-gray-400">{t(lang, 'Loading…', '載入中…')}</p>
            ) : activities.length === 0 ? (
              <p className="text-sm text-gray-400">{t(lang, 'No activities yet.', '尚無活動。')}</p>
            ) : (
              <div className="flex flex-col gap-3">
                {activities.map((a) => {
                  const tasks = a.tasks ?? []
                  const done  = tasks.filter((tk) => tk.status === 'done').length
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
    </LangProvider>
  )
}
