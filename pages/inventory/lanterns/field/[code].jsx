import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'
import Head from 'next/head'
import Link from 'next/link'
import { getInventoryRole } from '@/lib/inventory'
import { getCheckedIds, clearChecked } from '@/lib/inventoryFieldDraft'
import InventoryQuickInspectSheet from '@/components/InventoryQuickInspectSheet'
import InventoryFieldNewLanternSheet from '@/components/InventoryFieldNewLanternSheet'
import Spinner from '@/components/Spinner'

// Lazy-loaded: pulls in the jsQR decoder (~50kB), which most Field mode visits never
// touch — keeping it out of the page's initial bundle matters on the weak on-site
// signal this module is built for.
const InventoryQrScanner = dynamic(() => import('@/components/InventoryQrScanner'), { ssr: false })

export default function FieldWalkthrough() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { code } = router.query
  const role = getInventoryRole(session)

  const [location, setLocation] = useState(null)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [checkedIds, setCheckedIds] = useState([])
  const [activeLantern, setActiveLantern] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [scanError, setScanError] = useState('')
  const [marking, setMarking] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/inventory')
    if (status === 'authenticated' && (!role || role === 'viewer')) router.replace('/inventory/lanterns')
  }, [status, role])

  function load() {
    if (!code) return
    setLoading(true)
    fetch(`/api/inventory/locations/${code}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null }
        return r.json()
      })
      .then((d) => {
        if (d) { setLocation(d); setCheckedIds(getCheckedIds(code)) }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    if (status === 'authenticated' && role && role !== 'viewer') load()
  }, [status, role, code])

  useEffect(() => {
    if (status !== 'authenticated' || !role || role === 'viewer') return
    fetch('/api/inventory/categories').then((r) => r.json()).then((d) => setCategories(Array.isArray(d) ? d : []))
  }, [status, role])

  async function handleScanned(tagId) {
    setShowScanner(false)
    setScanError('')
    const res = await fetch(`/api/inventory/lanterns/${tagId}`)
    if (!res.ok) {
      setScanError(`找不到標籤 ${tagId}`)
      return
    }
    setActiveLantern(await res.json())
  }

  async function handleMarkDone() {
    setMarking(true)
    await fetch(`/api/inventory/locations/${code}/walkthrough`, { method: 'POST' })
    clearChecked(code)
    setMarking(false)
    load()
  }

  if (status !== 'authenticated' || !role || role === 'viewer') return null

  const total = location?.lanterns.length ?? 0
  const checkedCount = location?.lanterns.filter((l) => checkedIds.includes(l.id)).length ?? 0

  return (
    <>
      <Head>
        <title>{code ?? '現場模式'} · 燈籠庫存</title>
        <link rel="manifest" href="/inventory-field-manifest.json" />
        <link rel="apple-touch-icon" href="/icons/lantern-180.png" />
        <meta name="theme-color" content="#dc2626" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </Head>
      <div className="min-h-screen bg-gray-50 pb-24">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Link href="/inventory/lanterns/field" className="text-gray-400 hover:text-gray-700 text-base shrink-0">← 現場模式</Link>
              <div className="min-w-0">
                <h1 className="font-semibold text-gray-900">{code}</h1>
                {location && <p className="text-sm text-gray-500">已檢查 {checkedCount} / {total}</p>}
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-6 space-y-6">
          {loading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : notFound ? (
            <p className="text-base text-gray-400">找不到此地點。</p>
          ) : location ? (
            <>
              {location.last_walkthrough_at && (
                <p className="text-sm text-gray-400">
                  上次完成走訪：{new Date(location.last_walkthrough_at).toLocaleString('zh-TW')}
                </p>
              )}

              {scanError && (
                <p className="text-sm text-red-500">{scanError}</p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setShowScanner(true)}
                  className="flex-1 py-4 bg-white border-2 border-blue-600 text-blue-700 rounded-lg text-base font-medium hover:bg-blue-50"
                >
                  掃描 Scan QR
                </button>
                <button
                  onClick={() => setShowNew(true)}
                  className="flex-1 py-4 bg-blue-600 text-white rounded-lg text-base font-medium hover:bg-blue-700"
                >
                  + 新增燈籠 New
                </button>
              </div>

              {location.lanterns.length === 0 ? (
                <p className="text-base text-gray-400">此地點尚無燈籠記錄。</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {location.lanterns.map((lt) => {
                    const checked = checkedIds.includes(lt.id)
                    return (
                      <button
                        key={lt.id}
                        onClick={() => setActiveLantern(lt)}
                        className={`relative text-left bg-white rounded-lg border-2 p-3 ${checked ? 'border-green-400' : 'border-gray-200'}`}
                      >
                        {checked && (
                          <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-green-500 text-white text-xs flex items-center justify-center">✓</span>
                        )}
                        <p className="font-mono text-sm text-gray-400">{lt.tag_id}</p>
                        <p className="font-semibold text-gray-900 text-base truncate">{lt.name_zh}</p>
                        <p className="text-sm text-gray-400">{lt.condition} · QTY {lt.qty}</p>
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          ) : null}
        </main>

        {location && (
          <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 p-4">
            <div className="max-w-6xl mx-auto">
              <button
                onClick={handleMarkDone}
                disabled={marking}
                className="w-full py-3 bg-gray-800 text-white rounded-lg text-base font-medium hover:bg-gray-900 disabled:opacity-50"
              >
                {marking ? '處理中…' : '標記此地點已完成 Mark Location Done'}
              </button>
            </div>
          </div>
        )}
      </div>

      {activeLantern && (
        <InventoryQuickInspectSheet
          lantern={activeLantern}
          fixedLocationId={location.id}
          locationCode={code}
          onClose={() => setActiveLantern(null)}
          onSaved={() => { setActiveLantern(null); load() }}
        />
      )}

      {showNew && location && (
        <InventoryFieldNewLanternSheet
          fixedLocationId={location.id}
          locationCode={code}
          categories={categories}
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); load() }}
        />
      )}

      {showScanner && (
        <InventoryQrScanner onScan={handleScanned} onClose={() => setShowScanner(false)} />
      )}
    </>
  )
}
