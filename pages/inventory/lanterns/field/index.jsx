import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { getInventoryRole } from '@/lib/inventory'
import InventoryLanternNav from '@/components/InventoryLanternNav'
import Spinner from '@/components/Spinner'

const ZONE_ORDER = ['A', 'B', 'C', 'D', 'E', 'Cabin']

export default function FieldLocationPicker() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const role = getInventoryRole(session)

  const [locations, setLocations] = useState([])
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
  }, [status, role])

  if (status !== 'authenticated' || !role || role === 'viewer') return null

  const byZone = ZONE_ORDER.map((zone) => ({
    zone,
    items: locations.filter((l) => l.zone === zone),
  })).filter((g) => g.items.length > 0)

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
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center gap-3">
            <Link href="/inventory/lanterns" className="text-gray-400 hover:text-gray-700 text-base">← 燈籠列表</Link>
            <div>
              <h1 className="font-semibold text-gray-900">現場模式</h1>
              <p className="text-sm text-gray-500">Field Mode — 選擇您所在的地點</p>
            </div>
          </div>
        </header>

        <InventoryLanternNav active="field" />

        <main className="max-w-6xl mx-auto px-6 py-8">
          {loading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : (
            <div className="space-y-8">
              {byZone.map((g) => (
                <div key={g.zone}>
                  <h2 className="text-base font-semibold text-gray-700 mb-3">
                    {g.zone === 'Cabin' ? 'Cabin' : `${g.zone} 區`}
                  </h2>
                  <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                    {g.items.map((l) => (
                      <Link key={l.id} href={`/inventory/lanterns/field/${l.code}`}>
                        <div className="bg-white rounded-lg border border-gray-200 py-4 text-center cursor-pointer hover:border-blue-400 hover:shadow-sm transition-all">
                          <p className="font-semibold text-gray-900 text-base">{l.code}</p>
                          <p className="text-sm text-gray-400">{l.lantern_count} 盞</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </>
  )
}
