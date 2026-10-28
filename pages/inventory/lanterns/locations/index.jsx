import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { getInventoryRole } from '@/lib/inventory'
import InventoryLocationForm from '@/components/InventoryLocationForm'
import InventoryLanternNav from '@/components/InventoryLanternNav'
import InventoryHeader from '@/components/InventoryHeader'
import Spinner from '@/components/Spinner'
import { groupLocationsByZone } from '@/lib/inventoryLocationSort'
import { formatLocationCounts, summarizeLanterns, UNASSIGNED_LOCATION_CODE, UNASSIGNED_LABEL } from '@/lib/inventoryConstants'

function LocationCard({ location }) {
  return (
    <Link href={`/inventory/lanterns/locations/${location.code}`}>
      <div className="bg-white rounded-lg border border-gray-200 p-3 flex gap-3 items-center cursor-pointer hover:border-blue-400 hover:shadow-sm transition-all">
        {location.photo_thumb_url ? (
          <img src={location.photo_thumb_url} alt={location.code} className="w-14 h-14 rounded object-cover shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded bg-gray-100 shrink-0 flex items-center justify-center text-gray-300 text-sm">
            無照片
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 text-base">{location.code}</p>
          <p className="text-sm text-gray-400 truncate">{location.description || '—'}</p>
        </div>
        <span className="text-sm text-gray-400 shrink-0 whitespace-nowrap">{formatLocationCounts(location.lantern_count, location.lantern_qty)}</span>
      </div>
    </Link>
  )
}

export default function LocationsList() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const role = getInventoryRole(session)

  const [locations, setLocations] = useState([])
  const [unassigned, setUnassigned] = useState(null) // { records, qty }
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
    fetch(`/api/inventory/locations/${UNASSIGNED_LOCATION_CODE}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setUnassigned(d ? summarizeLanterns(d.lanterns) : null))
      .catch(() => {})
  }

  useEffect(() => {
    if (status === 'authenticated' && role) load()
  }, [status, role])

  if (status !== 'authenticated' || !role) return null

  const byZone = groupLocationsByZone(locations)

  return (
    <>
      <Head><title>地點 · 燈籠庫存</title></Head>
      <div className="min-h-screen bg-gray-50">
        <InventoryHeader
          icon="pin"
          backHref="/inventory/lanterns"
          backLabel="燈籠庫存"
          title="地點"
          subtitle="Locations"
          right={role === 'admin' && (
            <button onClick={() => setShowAdd(true)} className="text-base bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">
              + 新增地點
            </button>
          )}
        />

        <InventoryLanternNav active="locations" />

        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          {loading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : locations.length === 0 ? (
            <p className="text-base text-gray-400">尚無地點。</p>
          ) : (
            <div className="space-y-8">
              {byZone.map((g) => (
                <div key={g.zone}>
                  <h2 className="text-base font-semibold text-gray-700 mb-3">
                    {/^[A-Z]$/.test(g.zone) ? `${g.zone} 區` : g.zone}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {g.items.map((l) => <LocationCard key={l.id} location={l} />)}
                  </div>
                </div>
              ))}

              {unassigned?.records > 0 && (
                <div>
                  <h2 className="text-base font-semibold text-gray-700 mb-3">{UNASSIGNED_LABEL}</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <Link href={`/inventory/lanterns/locations/${UNASSIGNED_LOCATION_CODE}`}>
                      <div className="bg-amber-50 rounded-lg border border-amber-300 p-3 flex gap-3 items-center cursor-pointer hover:border-amber-500 hover:shadow-sm transition-all">
                        <div className="w-14 h-14 rounded bg-amber-100 shrink-0 flex items-center justify-center text-amber-500 text-xl">?</div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-amber-900 text-base">未指定地點</p>
                          <p className="text-sm text-amber-700 truncate">Unassigned — 尚未指定存放地點</p>
                        </div>
                        <span className="text-sm text-amber-700 shrink-0 whitespace-nowrap">{formatLocationCounts(unassigned.records, unassigned.qty)}</span>
                      </div>
                    </Link>
                  </div>
                </div>
              )}
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
