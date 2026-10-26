import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { getInventoryRole } from '@/lib/inventory'
import InventoryLocationForm from '@/components/InventoryLocationForm'
import Spinner from '@/components/Spinner'

export default function LocationDetail() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { code } = router.query
  const role = getInventoryRole(session?.user?.email)

  const [location, setLocation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showEdit, setShowEdit] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/inventory')
    if (status === 'authenticated' && !role) router.replace('/')
  }, [status, role])

  function load() {
    if (!code) return
    setLoading(true)
    fetch(`/api/inventory/locations/${code}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null }
        return r.json()
      })
      .then((d) => { if (d) setLocation(d); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    if (status === 'authenticated' && role) load()
  }, [status, role, code])

  if (status !== 'authenticated' || !role) return null

  return (
    <>
      <Head><title>{code ?? '地點'} · 燈籠庫存</title></Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Link href="/inventory/lanterns/locations" className="text-gray-400 hover:text-gray-700 text-sm shrink-0">← 地點</Link>
              <div className="min-w-0">
                <h1 className="font-semibold text-gray-900">{code}</h1>
                <p className="text-xs text-gray-500">{location ? `${location.zone} 區` : ''}</p>
              </div>
            </div>
            {role === 'admin' && location && (
              <button
                onClick={() => setShowEdit(true)}
                className="text-sm bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-50 shrink-0"
              >
                編輯
              </button>
            )}
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-10">
          {loading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : notFound ? (
            <p className="text-sm text-gray-400">找不到此地點。</p>
          ) : location ? (
            <div className="space-y-6">
              <div className="bg-white rounded-lg border border-gray-200 p-5 flex gap-5">
                {location.photo_url ? (
                  <img src={location.photo_url} alt={location.code} className="w-32 h-32 rounded object-cover shrink-0" />
                ) : (
                  <div className="w-32 h-32 rounded bg-gray-100 shrink-0 flex items-center justify-center text-gray-300 text-xs">
                    無照片
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{location.description || '尚無說明'}</p>
                </div>
              </div>

              <div>
                <h2 className="text-sm font-semibold text-gray-700 mb-3">
                  此處燈籠 Lanterns here ({location.lanterns.length})
                </h2>
                {location.lanterns.length === 0 ? (
                  <p className="text-sm text-gray-400">尚無燈籠存放於此。</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {location.lanterns.map((lt) => (
                      <div key={lt.id} className="bg-white rounded-lg border border-gray-200 p-3">
                        <p className="font-semibold text-gray-900 text-sm">{lt.tag_id} — {lt.name_zh}</p>
                        <p className="text-xs text-gray-400">{lt.condition} · QTY {lt.qty}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </main>
      </div>

      {showEdit && location && (
        <InventoryLocationForm
          location={location}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); load() }}
        />
      )}
    </>
  )
}
