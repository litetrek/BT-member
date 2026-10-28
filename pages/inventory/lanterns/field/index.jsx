import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { getInventoryRole } from '@/lib/inventory'
import InventoryLanternNav from '@/components/InventoryLanternNav'
import InventoryHeader from '@/components/InventoryHeader'
import Spinner from '@/components/Spinner'
import { groupLocationsByZone } from '@/lib/inventoryLocationSort'
import { formatLocationCounts, summarizeLanterns, UNASSIGNED_LOCATION_CODE, UNASSIGNED_LABEL } from '@/lib/inventoryConstants'

export default function FieldLocationPicker() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const role = getInventoryRole(session)

  const [locations, setLocations] = useState([])
  const [unassigned, setUnassigned] = useState(null) // { records, qty }
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/inventory')
    if (status === 'authenticated' && (!role || role === 'viewer')) router.replace('/inventory/lanterns')
  }, [status, role])

  useEffect(() => {
    if (status !== 'authenticated' || !role || role === 'viewer') return
    fetch('/api/inventory/locations')
      .then((r) => r.json())
      .then((d) => { setLocations(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
    fetch(`/api/inventory/locations/${UNASSIGNED_LOCATION_CODE}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setUnassigned(d ? summarizeLanterns(d.lanterns) : null))
      .catch(() => {})
  }, [status, role])

  if (status !== 'authenticated' || !role || role === 'viewer') return null

  const byZone = groupLocationsByZone(locations)

  return (
    <>
      <Head>
        <title>現場模式 · 燈籠庫存</title>
        <link rel="manifest" href="/inventory-field-manifest.json" />
        <link rel="apple-touch-icon" href="/icons/lantern-180.png" />
        <meta name="theme-color" content="#dc2626" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </Head>
      <div className="min-h-screen bg-gray-50">
        <InventoryHeader icon="compass" backHref="/inventory/lanterns" backLabel="燈籠列表" title="現場模式" subtitle="Field Mode — 選擇您所在的地點" />

        <InventoryLanternNav active="field" />

        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          {loading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : (
            <div className="space-y-8">
              {byZone.map((g) => (
                <div key={g.zone}>
                  <h2 className="text-base font-semibold text-gray-700 mb-3">
                    {/^[A-Z]$/.test(g.zone) ? `${g.zone} 區` : g.zone}
                  </h2>
                  <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                    {g.items.map((l) => (
                      <Link key={l.id} href={`/inventory/lanterns/field/${l.code}`}>
                        <div className="bg-white rounded-lg border border-gray-200 py-4 text-center cursor-pointer hover:border-blue-400 hover:shadow-sm transition-all">
                          <p className="font-semibold text-gray-900 text-base">{l.code}</p>
                          <p className="text-xs sm:text-sm text-gray-400 whitespace-nowrap">{formatLocationCounts(l.lantern_count, l.lantern_qty)}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}

              {unassigned?.records > 0 && (
                <div>
                  <h2 className="text-base font-semibold text-gray-700 mb-3">{UNASSIGNED_LABEL}</h2>
                  <Link href={`/inventory/lanterns/field/${UNASSIGNED_LOCATION_CODE}`}>
                    <div className="bg-amber-50 rounded-lg border border-amber-300 px-4 py-4 flex items-center justify-between cursor-pointer hover:border-amber-500 hover:shadow-sm transition-all">
                      <p className="font-semibold text-amber-900 text-base">未指定地點</p>
                      <p className="text-sm text-amber-700 whitespace-nowrap">{formatLocationCounts(unassigned.records, unassigned.qty)}</p>
                    </div>
                  </Link>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </>
  )
}
