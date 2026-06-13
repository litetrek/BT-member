import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import Head from 'next/head'

function EventCard({ event }) {
  const isActive = event.status === 'active'
  const dateStr = new Date(event.event_date).toLocaleDateString('zh-TW', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <Link href={`/${event.slug}`}>
      <div
        className={`bg-white rounded-lg border p-5 cursor-pointer hover:shadow-sm transition-shadow ${
          isActive ? 'border-blue-400 ring-1 ring-blue-400' : 'border-gray-200'
        }`}
      >
        <div className="flex items-start justify-between mb-3">
          <span className="text-xs text-gray-400">
            {new Date(event.event_date).getFullYear()}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded font-medium ${
              isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {isActive ? '進行中' : '已結束'}
          </span>
        </div>
        <h2 className="font-semibold text-gray-900 text-sm mb-1">{event.name}</h2>
        <p className="text-xs text-gray-500 mb-3">{dateStr}</p>
        <p className="text-xs text-gray-400 font-mono">
          bt.cyber-tech.com/{event.slug}
        </p>
      </div>
    </Link>
  )
}

export default function Home() {
  const { data: session } = useSession()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/events')
      .then((r) => r.json())
      .then((d) => { setEvents(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <>
      <Head><title>聖天湖佛教城</title></Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="font-semibold text-gray-900">聖天湖佛教城</h1>
              <p className="text-xs text-gray-500">bt.cyber-tech.com</p>
            </div>
            {session?.user?.role === 'admin' && (
              <button className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">
                + 新增活動
              </button>
            )}
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-10">
          {loading ? (
            <p className="text-sm text-gray-400">載入中…</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-gray-400">尚無活動。</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {events.map((e) => <EventCard key={e.id} event={e} />)}
            </div>
          )}
        </main>
      </div>
    </>
  )
}
