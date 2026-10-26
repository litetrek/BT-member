import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { getInventoryRole } from '@/lib/inventory'
import InventoryLocationForm from '@/components/InventoryLocationForm'
import InventoryLanternNav from '@/components/InventoryLanternNav'
import Spinner from '@/components/Spinner'

const ZONE_ORDER = ['A', 'B', 'C', 'D', 'E', 'Cabin']

function LocationCard({ location }) {
  return (
    <Link href={`/inventory/lanterns/locations/${location.code}`}>
      <div className="bg-white rounded-lg border border-gray-200 p-3 flex gap-3 items-center cursor-pointer hover:border-blue-400 hover:shadow-sm transition-all">
        {location.photo_thumb_url ? (
          <img src={location.photo_thumb_url} alt={location.code} className="w-14 h-14 rounded object-cover shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded bg-gray-100 shrink-0 flex items-center justify-center text-gray-300 text-xs">
            無照片
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 text-sm">{location.code}</p>
          <p className="text-xs text-gray-400 truncate">{location.description || '—'}</p>
        </div>
        <span className="text-xs text-gray-400 shrink-0">{location.lantern_count} 盞</span>
      </div>
    </Link>
  )
}

export default function LocationsList() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const role = getInventoryRole(session?.user?.email)

  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/inventory')
    if (status === 'authenticated' && !role) router.replace('/')
  }, [status, role])

  function load() {
    setLoading(true)
    fetch('/api/inventory/locations')
      .then((r) => r.json())
      .then((d) => { setLocations(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    if (status === 'authenticated' && role) load()
  }, [status, role])

  if (status !== 'authenticated' || !role) return null

  const byZone = ZONE_ORDER.map((zone) => ({
    zone,
    items: locations.filter((l) => l.zone === zone),
  })).filter((g) => g.items.length > 0)

  return (
    <>
      <Head><title>地點 · 燈籠庫存</title></Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Link href="/inventory/lanterns" className="text-gray-400 hover:text-gray-700 text-sm shrink-0">← 燈籠庫存</Link>
              <div className="min-w-0">
                <h1 className="font-semibold text-gray-900">地點</h1>
                <p className="text-xs text-gray-500">Locations</p>
              </div>
            </div>
            {role === 'admin' && (
              <button
                onClick={() => setShowAdd(true)}
                className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 shrink-0"
              >
                + 新增地點
              </button>
            )}
          </div>
        </header>

        <InventoryLanternNav active="locations" />

        <main className="max-w-6xl mx-auto px-6 py-10">
          {loading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : locations.length === 0 ? (
            <p className="text-sm text-gray-400">尚無地點。</p>
          ) : (
            <div className="space-y-8">
              {byZone.map((g) => (
                <div key={g.zone}>
                  <h2 className="text-sm font-semibold text-gray-700 mb-3">
                    {g.zone === 'Cabin' ? 'Cabin' : `${g.zone} 區`}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {g.items.map((l) => <LocationCard key={l.id} location={l} />)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {showAdd && (
        <InventoryLocationForm
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load() }}
        />
      )}
    </>
  )
}
