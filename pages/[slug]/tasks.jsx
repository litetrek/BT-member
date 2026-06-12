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

const STATUS_FILTERS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
  { value: 'overdue', label: 'Overdue' },
]

function Section({ title, tasks, currentUserId, userRole, onStatusChange, onEdit, onOpen, highlightId }) {
  if (!tasks.length) return null
  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        {title} <span className="font-normal">({tasks.length})</span>
      </h2>
      <div className="flex flex-col gap-2">
        {tasks.map((t) => (
          <TaskItem
            key={t.id}
            task={t}
            currentUserId={currentUserId}
            userRole={userRole}
            onStatusChange={onStatusChange}
            onEdit={onEdit}
            onOpen={onOpen}
            highlighted={t.id === highlightId}
          />
        ))}
      </div>
    </div>
  )
}

export default function TasksPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { slug, id: highlightId } = router.query

  const [tasks, setTasks] = useState([])
  const [activities, setActivities] = useState([])
  const [eventId, setEventId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filterActivity, setFilterActivity] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editTask, setEditTask] = useState(null)
  const [detailTask, setDetailTask] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

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

  // Scroll to deep-linked task
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
    // Refresh detailTask data from updated tasks list
    setDetailTask((prev) => prev)
  }

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const userRole = session?.user?.role ?? 'member'
  const canAddTask = ['admin', 'lead'].includes(userRole)

  let visible = tasks
  if (filterActivity !== 'all') visible = visible.filter((t) => t.activity_id === filterActivity)
  if (filterStatus === 'overdue') {
    visible = visible.filter((t) => t.status !== 'done' && t.due_date && new Date(t.due_date) < today)
  } else if (filterStatus !== 'all') {
    visible = visible.filter((t) => t.status === filterStatus)
  }

  const overdue    = visible.filter((t) => t.status !== 'done' && t.due_date && new Date(t.due_date) < today)
  const inProgress = visible.filter((t) => t.status === 'in_progress' && !(t.due_date && new Date(t.due_date) < today))
  const open       = visible.filter((t) => t.status === 'open' && !(t.due_date && new Date(t.due_date) < today))
  const done       = visible.filter((t) => t.status === 'done')

  const isEmpty = overdue.length + inProgress.length + open.length + done.length === 0

  const selectCls = 'border border-gray-200 rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400'

  return (
    <>
      <Head><title>Tasks · {slug}</title></Head>
      <Layout slug={slug} activePage="tasks" user={session?.user} userRole={userRole}>
        <ErrorBoundary>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
            <h1 className="text-lg font-semibold text-gray-900">Tasks</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={filterActivity}
                onChange={(e) => setFilterActivity(e.target.value)}
                className={selectCls}
              >
                <option value="all">All Activities</option>
                {activities.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className={selectCls}
              >
                {STATUS_FILTERS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              {canAddTask && (
                <button
                  onClick={() => { setEditTask(null); setShowForm(true) }}
                  className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
                >
                  + Add Task
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-gray-400">No tasks yet. {canAddTask && 'Add the first one.'}</p>
          ) : isEmpty ? (
            <p className="text-sm text-gray-400">No tasks match the current filters.</p>
          ) : (
            <>
              <Section
                title="Overdue"
                tasks={overdue}
                currentUserId={session?.user?.id}
                userRole={userRole}
                onStatusChange={handleStatusChange}
                onEdit={(t) => { setEditTask(t); setShowForm(true) }}
                onOpen={setDetailTask}
                highlightId={highlightId}
              />
              <Section
                title="In Progress"
                tasks={inProgress}
                currentUserId={session?.user?.id}
                userRole={userRole}
                onStatusChange={handleStatusChange}
                onEdit={(t) => { setEditTask(t); setShowForm(true) }}
                onOpen={setDetailTask}
                highlightId={highlightId}
              />
              <Section
                title="Open"
                tasks={open}
                currentUserId={session?.user?.id}
                userRole={userRole}
                onStatusChange={handleStatusChange}
                onEdit={(t) => { setEditTask(t); setShowForm(true) }}
                onOpen={setDetailTask}
                highlightId={highlightId}
              />
              <Section
                title="Done"
                tasks={done}
                currentUserId={session?.user?.id}
                userRole={userRole}
                onStatusChange={handleStatusChange}
                onEdit={(t) => { setEditTask(t); setShowForm(true) }}
                onOpen={setDetailTask}
                highlightId={highlightId}
              />
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
          message={`Delete "${deleteTarget.title}"? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => handleDelete(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  )
}
