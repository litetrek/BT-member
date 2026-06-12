import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Layout from '@/components/Layout'
import AISummary from '@/components/AISummary'
import AIChat from '@/components/AIChat'

export default function AIPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { slug } = router.query
  const [eventId, setEventId] = useState(null)

  const userRole = session?.user?.role

  useEffect(() => {
    if (status === 'unauthenticated') { router.replace(`/${slug}`); return }
    if (status === 'authenticated' && userRole && !['admin', 'lead'].includes(userRole)) {
      router.replace(`/${slug}/dashboard`)
    }
  }, [status, userRole, slug])

  useEffect(() => {
    if (!slug || status !== 'authenticated') return
    fetch('/api/events')
      .then((r) => r.json())
      .then((events) => {
        const ev = (events ?? []).find((e) => e.slug === slug)
        if (ev) setEventId(ev.id)
      })
      .catch(() => {})
  }, [slug, status])

  return (
    <>
      <Head><title>AI 助理 · {slug}</title></Head>
      <Layout slug={slug} activePage="ai" user={session?.user} userRole={userRole}>
        <h1 className="text-lg font-semibold text-gray-900 mb-6">AI 助理</h1>
        {eventId ? (
          <div className="flex flex-col gap-6">
            <AISummary eventId={eventId} />
            <AIChat eventId={eventId} />
          </div>
        ) : (
          <p className="text-sm text-gray-400">載入中…</p>
        )}
      </Layout>
    </>
  )
}
