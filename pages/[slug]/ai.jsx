import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Layout from '@/components/Layout'
import AISummary from '@/components/AISummary'
import AIChat from '@/components/AIChat'
import { LangProvider } from '@/context/LangContext'
import { t } from '@/lib/lang'
import Link from 'next/link'

export default function AIPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { slug } = router.query
  const [eventId, setEventId] = useState(null)
  const lang = session?.user?.preferred_lang ?? 'zh'

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
    <LangProvider lang={lang}>
      <Head><title>{t(lang, 'AI Assistant', 'AI 助理')} · {slug}</title></Head>
      <Layout slug={slug} activePage="ai" user={session?.user} userRole={userRole}>
        <h1 className="text-lg font-semibold text-gray-900 mb-6">{t(lang, 'AI Assistant', 'AI 助理')}</h1>
        {eventId ? (
          <div className="flex flex-col gap-6">
            <Link href={`/${slug}/import`} className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-sm transition-all">
              <div className="flex items-center gap-3">
                <span className="ti ti-file-import text-xl text-blue-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{t(lang, 'Import chat (WhatsApp / SMS)', '匯入聊天紀錄（WhatsApp／簡訊）')}</p>
                  <p className="text-xs text-gray-500">{t(lang, 'AI turns the group chat into status updates, tasks and photos; you confirm before saving.', 'AI 把群組聊天整理成狀態更新、任務和照片，確認後才儲存。')}</p>
                </div>
                <span className="text-gray-300">›</span>
              </div>
            </Link>
            <AISummary eventId={eventId} />
            <AIChat eventId={eventId} />
          </div>
        ) : (
          <p className="text-sm text-gray-400">{t(lang, 'Loading…', '載入中…')}</p>
        )}
      </Layout>
    </LangProvider>
  )
}
