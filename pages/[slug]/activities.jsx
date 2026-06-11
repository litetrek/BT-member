import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Layout from '@/components/Layout'
import ActivityCard from '@/components/ActivityCard'
import ActivityForm from '@/components/ActivityForm'

export default function ActivitiesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { slug } = router.query

  const [activities, setActivities] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [eventId, setEventId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editActivity, setEditActivity] = useState(null)
  const [newMsg, setNewMsg] = useState('')
  const [postingMsg, setPostingMsg] = useState(false)

  const isAdmin = session?.user?.role === 'admin'

  useEffect(() => {
    if (status === 'unauthenticated') router.replace(`/${slug}`)
  }, [status, slug])

  function load() {
    if (!slug) return
    fetch(`/api/activities?slug=${slug}`)
      .then((r) => r.json())
      .then((d) => {
        setActivities(Array.isArray(d) ? d : [])
        // Pull event_id from first activity, or fetch events
        if (d?.[0]?.event_id) setEventId(d[0].event_id)
      })
  }

  function loadAnnouncements(eid) {
    if (!eid) return
    fetch(`/api/announcements?event_id=${eid}`)
      .then((r) => r.json())
      .then((d) => setAnnouncements(Array.isArray(d) ? d : []))
  }

  useEffect(() => {
    if (slug && status === 'authenticated') {
      // Get event id from events API
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
    if (!confirm('Delete this activity?')) return
    await fetch(`/api/activities/${id}`, { method: 'DELETE' })
    load()
  }

  async function handlePostAnnouncement(e) {
    e.preventDefault()
    if (!newMsg.trim() || !eventId) return
    setPostingMsg(true)
    await fetch('/api/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: eventId, message: newMsg }),
    })
    setNewMsg('')
    loadAnnouncements(eventId)
    setPostingMsg(false)
  }

  return (
    <>
      <Head><title>Activities · {slug}</title></Head>
      <Layout slug={slug} activePage="activities" user={session?.user} userRole={session?.user?.role}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold text-gray-900">Activities</h1>
          {isAdmin && (
            <button
              onClick={() => { setEditActivity(null); setShowForm(true) }}
              className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
            >
              + Add Activity
            </button>
          )}
        </div>

        {activities.length === 0 ? (
          <p className="text-sm text-gray-400 mb-8">No activities yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            {activities.map((a) => (
              <ActivityCard
                key={a.id}
                activity={a}
                isAdmin={isAdmin}
                onEdit={(act) => { setEditActivity(act); setShowForm(true) }}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {/* Announcements */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-gray-700">Announcements</h2>
          </div>

          {isAdmin && (
            <form onSubmit={handlePostAnnouncement} className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="New announcement…"
                value={newMsg}
                onChange={(e) => setNewMsg(e.target.value)}
                className="flex-1 border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <button
                type="submit"
                disabled={postingMsg || !newMsg.trim()}
                className="text-sm bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Post
              </button>
            </form>
          )}

          {announcements.length === 0 ? (
            <p className="text-sm text-gray-400">No announcements.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {announcements.map((a) => (
                <div key={a.id} className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                  <p className="text-sm text-gray-800">{a.message}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(a.created_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </p>
                </div>
              ))}
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
      </Layout>
    </>
  )
}
