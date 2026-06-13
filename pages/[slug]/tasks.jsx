import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Layout from '@/components/Layout'
import TaskItem from '@/components/TaskItem'
import TaskForm from '@/components/TaskForm'
import TaskDetail from '@/components/TaskDetail'
import Spinner from '@/components/Spinner'
import ConfirmDialog from '@/components/ConfirmDialog'
import ErrorBoundary from '@/components/ErrorBoundary'
import { LangProvider, useLang } from '@/context/LangContext'
import { t } from '@/lib/lang'

function Section({ title, tasks, currentUserId, userRole, onStatusChange, onEdit, onOpen, highlightId }) {
  const lang = useLang()
  if (!tasks.length) return (
    <div className="mb-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{title}</h3>
      <p className="text-xs text-gray-400 pl-1">{t(lang, 'No tasks with this status', '沒有此狀態的任務')}</p>
    </div>
  )
  return (
    <div className="mb-6">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        {title} <span className="font-normal">({tasks.length})</span>
      </h3>
      <div className="flex flex-col gap-2">
        {tasks.map((tk) => (
          <TaskItem
            key={tk.id}
            task={tk}
            currentUserId={currentUserId}
            userRole={userRole}
            onStatusChange={onStatusChange}
            onEdit={onEdit}
            onOpen={onOpen}
            highlighted={tk.id === highlightId}
          />
        ))}
      </div>
    </div>
  )
}

function groupByStatus(tasks, today) {
  const overdue    = tasks.filter((tk) => tk.status !== 'done' && tk.due_date && new Date(tk.due_date) < today)
  const inProgress = tasks.filter((tk) => tk.status === 'in_progress' && !(tk.due_date && new Date(tk.due_date) < today))
  const open       = tasks.filter((tk) => tk.status === 'open'        && !(tk.due_date && new Date(tk.due_date) < today))
  const done       = tasks.filter((tk) => tk.status === 'done')
  return { overdue, inProgress, open, done }
}

export default function TasksPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { slug, id: highlightId } = router.query
  const lang = session?.user?.preferred_lang ?? 'zh'

  const [tasks, setTasks] = useState([])
  const [activities, setActivities] = useState([])
  const [eventId, setEventId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editTask, setEditTask] = useState(null)
  const [detailTask, setDetailTask] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const [filterActivity, setFilterActivity] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const userRole = session?.user?.role ?? 'member'
  const canAddTask = ['admin', 'lead'].includes(userRole)
  const isAdminOrLead = ['admin', 'lead'].includes(userRole)

  const defaultTab = isAdminOrLead ? 'all' : 'my_status'
  const [activeTab, setActiveTab] = useState(defaultTab)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace(`/${slug}`)
  }, [status, slug])

  function loadTasks() {
    if (!slug) return
    fetch(`/api/tasks?slug=${slug}`)
      .then((r) => r.json())
      .then((d) => { setTasks(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    if (!slug || status !== 'authenticated') return
    setLoading(true)

    fetch(`/api/activities?slug=${slug}`)
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d) ? d : []
        setActivities(list)
        if (list[0]?.event_id) setEventId(list[0].event_id)
      })
      .catch(() => {})

    loadTasks()
  }, [slug, status])

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

  useEffect(() => {
    if (!highlightId || loading) return
    setTimeout(() => {
      const el = document.getElementById(`task-${highlightId}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 200)
  }, [highlightId, loading])

  async function handleStatusChange(taskId, newStatus) {
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    loadTasks()
  }

  async function handleDelete(taskId) {
    await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
    setDeleteTarget(null)
    setShowForm(false)
    loadTasks()
  }

  function handleDetailSaved() {
    loadTasks()
    setDetailTask((prev) => prev)
  }

  const userId = session?.user?.id
  const myTasks = tasks.filter((tk) => tk.assignee_1_id === userId || tk.assignee_2_id === userId)

  const tabs = [
    ...(isAdminOrLead ? [{ key: 'all',         label: t(lang, 'All Tasks',              '全部任務') }] : []),
    { key: 'my_status',   label: t(lang, 'My Tasks (by Status)',   '我的任務（按狀態）') },
    { key: 'my_activity', label: t(lang, 'My Tasks (by Activity)', '我的任務（按活動）') },
  ]

  const selectCls = 'border border-gray-200 rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400'

  function renderAllTasks() {
    let visible = tasks
    if (filterActivity !== 'all') visible = visible.filter((tk) => tk.activity_id === filterActivity)
    if (filterStatus === 'overdue') {
      visible = visible.filter((tk) => tk.status !== 'done' && tk.due_date && new Date(tk.due_date) < today)
    } else if (filterStatus !== 'all') {
      visible = visible.filter((tk) => tk.status === filterStatus)
    }
    const { overdue, inProgress, open, done } = groupByStatus(visible, today)
    const isEmpty = overdue.length + inProgress.length + open.length + done.length === 0

    return (
      <>
        <div className="flex items-center gap-2 flex-wrap mb-6">
          <select value={filterActivity} onChange={(e) => setFilterActivity(e.target.value)} className={selectCls}>
            <option value="all">{t(lang, 'All Activities', '全部活動')}</option>
            {activities.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectCls}>
            <option value="all">{t(lang, 'All Statuses', '全部狀態')}</option>
            <option value="open">{t(lang, 'Not Started', '未開始')}</option>
            <option value="in_progress">{t(lang, 'In Progress', '進行中')}</option>
            <option value="done">{t(lang, 'Done', '已完成')}</option>
            <option value="overdue">{t(lang, 'Overdue', '逾期')}</option>
          </select>
        </div>
        {isEmpty ? (
          <p className="text-sm text-gray-400">{t(lang, 'No tasks match the current filters.', '目前篩選條件下沒有任務。')}</p>
        ) : (
          <>
            <Section title={t(lang, 'OVERDUE',      '逾期')}   tasks={overdue}    currentUserId={userId} userRole={userRole} onStatusChange={handleStatusChange} onEdit={(tk) => { setEditTask(tk); setShowForm(true) }} onOpen={setDetailTask} highlightId={highlightId} />
            <Section title={t(lang, 'IN PROGRESS',  '進行中')} tasks={inProgress} currentUserId={userId} userRole={userRole} onStatusChange={handleStatusChange} onEdit={(tk) => { setEditTask(tk); setShowForm(true) }} onOpen={setDetailTask} highlightId={highlightId} />
            <Section title={t(lang, 'NOT STARTED',  '未開始')} tasks={open}       currentUserId={userId} userRole={userRole} onStatusChange={handleStatusChange} onEdit={(tk) => { setEditTask(tk); setShowForm(true) }} onOpen={setDetailTask} highlightId={highlightId} />
            <Section title={t(lang, 'DONE',         '已完成')} tasks={done}       currentUserId={userId} userRole={userRole} onStatusChange={handleStatusChange} onEdit={(tk) => { setEditTask(tk); setShowForm(true) }} onOpen={setDetailTask} highlightId={highlightId} />
          </>
        )}
      </>
    )
  }

  function renderMyByStatus() {
    if (myTasks.length === 0) return <p className="text-sm text-gray-400">{t(lang, 'You have no tasks.', '您目前沒有任何任務')}</p>
    const { overdue, inProgress, open, done } = groupByStatus(myTasks, today)
    return (
      <>
        <Section title={t(lang, 'OVERDUE',     '逾期')}   tasks={overdue}    currentUserId={userId} userRole={userRole} onStatusChange={handleStatusChange} onEdit={(tk) => { setEditTask(tk); setShowForm(true) }} onOpen={setDetailTask} highlightId={highlightId} />
        <Section title={t(lang, 'IN PROGRESS', '進行中')} tasks={inProgress} currentUserId={userId} userRole={userRole} onStatusChange={handleStatusChange} onEdit={(tk) => { setEditTask(tk); setShowForm(true) }} onOpen={setDetailTask} highlightId={highlightId} />
        <Section title={t(lang, 'NOT STARTED', '未開始')} tasks={open}       currentUserId={userId} userRole={userRole} onStatusChange={handleStatusChange} onEdit={(tk) => { setEditTask(tk); setShowForm(true) }} onOpen={setDetailTask} highlightId={highlightId} />
        <Section title={t(lang, 'DONE',        '已完成')} tasks={done}       currentUserId={userId} userRole={userRole} onStatusChange={handleStatusChange} onEdit={(tk) => { setEditTask(tk); setShowForm(true) }} onOpen={setDetailTask} highlightId={highlightId} />
      </>
    )
  }

  function renderMyByActivity() {
    if (myTasks.length === 0) return <p className="text-sm text-gray-400">{t(lang, 'You have no tasks.', '您目前沒有任何任務')}</p>

    const activityMap = {}
    for (const tk of myTasks) {
      const aid = tk.activity_id
      if (!activityMap[aid]) activityMap[aid] = []
      activityMap[aid].push(tk)
    }

    return (
      <>
        {Object.entries(activityMap).map(([aid, atasks]) => {
          const activity = activities.find((a) => a.id === aid)
          const activityName = activity?.name ?? atasks[0]?.activity?.name ?? t(lang, '(Unknown Activity)', '（未知活動）')
          const icon = activity?.icon ?? ''
          return (
            <div key={aid} className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                {icon && <span className={`ti ${icon} text-blue-500`} />}
                {activityName}
              </h3>
              <div className="flex flex-col gap-2">
                {atasks.map((tk) => (
                  <TaskItem
                    key={tk.id}
                    task={tk}
                    currentUserId={userId}
                    userRole={userRole}
                    onStatusChange={handleStatusChange}
                    onEdit={(tt) => { setEditTask(tt); setShowForm(true) }}
                    onOpen={setDetailTask}
                    highlighted={tk.id === highlightId}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </>
    )
  }

  return (
    <LangProvider lang={lang}>
      <Head><title>{t(lang, 'Tasks', '任務')} · {slug}</title></Head>
      <Layout slug={slug} activePage="tasks" user={session?.user} userRole={userRole}>
        <ErrorBoundary>
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-semibold text-gray-900">{t(lang, 'Tasks', '任務')}</h1>
            {canAddTask && (
              <button
                onClick={() => { setEditTask(null); setShowForm(true) }}
                className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
              >
                + {t(lang, 'Add Task', '新增任務')}
              </button>
            )}
          </div>

          {/* Tab pills */}
          <div className="flex gap-2 flex-wrap mb-6 border-b border-gray-200 pb-0">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-sm rounded-t-lg border-b-2 transition-colors -mb-px ${
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-700 font-medium bg-white'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-gray-400">
              {t(lang, 'No tasks yet.', '尚無任務。')}
              {canAddTask && ' ' + t(lang, 'Add the first one.', '新增第一個任務。')}
            </p>
          ) : (
            <>
              {activeTab === 'all'         && renderAllTasks()}
              {activeTab === 'my_status'   && renderMyByStatus()}
              {activeTab === 'my_activity' && renderMyByActivity()}
            </>
          )}
        </ErrorBoundary>
      </Layout>

      {detailTask && (
        <TaskDetail
          task={detailTask}
          onClose={() => setDetailTask(null)}
          onSaved={handleDetailSaved}
        />
      )}

      {showForm && eventId && (
        <TaskForm
          slug={slug}
          eventId={eventId}
          task={editTask}
          activities={activities}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); loadTasks() }}
          onDelete={editTask ? () => setDeleteTarget(editTask) : undefined}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={t(lang,
            `Delete "${deleteTarget.title}"? This cannot be undone.`,
            `確定要刪除「${deleteTarget.title}」？此操作無法復原。`
          )}
          confirmLabel={t(lang, 'Delete', '刪除')}
          onConfirm={() => handleDelete(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </LangProvider>
  )
}
