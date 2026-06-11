import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Layout from '@/components/Layout'
import StatusBadge from '@/components/StatusBadge'

export default function TasksPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { slug } = router.query
  const [tasks, setTasks] = useState([])

  useEffect(() => {
    if (status === 'unauthenticated') router.replace(`/${slug}`)
  }, [status, slug])

  useEffect(() => {
    if (!slug || status !== 'authenticated') return
    fetch(`/api/tasks?slug=${slug}`)
      .then((r) => r.json())
      .then((d) => setTasks(Array.isArray(d) ? d : []))
  }, [slug, status])

  return (
    <>
      <Head><title>Tasks · {slug}</title></Head>
      <Layout slug={slug} activePage="tasks" user={session?.user} userRole={session?.user?.role}>
        <h1 className="text-lg font-semibold text-gray-900 mb-6">Tasks</h1>
        {tasks.length === 0 ? (
          <p className="text-sm text-gray-400">No tasks yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {tasks.map((t) => (
              <div key={t.id} className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-gray-800">{t.title}</p>
                  <p className="text-xs text-gray-400">{t.activity?.name}</p>
                </div>
                <StatusBadge status={t.status} dueDate={t.due_date} />
              </div>
            ))}
          </div>
        )}
      </Layout>
    </>
  )
}
