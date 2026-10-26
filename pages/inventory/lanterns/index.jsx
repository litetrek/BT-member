import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { getInventoryRole } from '@/lib/inventory'
import { uploadInventoryPhoto } from '@/lib/inventoryPhoto'

function PhotoUploadTest() {
  const [status, setStatus] = useState('idle') // idle | uploading | done | error
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setStatus('uploading')
    setError('')
    try {
      const { url, thumbUrl } = await uploadInventoryPhoto(file, 'test', `stage0-${Date.now()}`)
      setResult({ url, thumbUrl })
      setStatus('done')
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-sm font-semibold text-gray-900 mb-1">Stage 0 — 照片上傳測試</h2>
      <p className="text-xs text-gray-400 mb-4">Photo upload test (temporary — removed once Stage 2 ships the real lantern form)</p>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="text-sm"
      />
      {status === 'uploading' && <p className="text-xs text-gray-400 mt-3">上傳中… Uploading…</p>}
      {status === 'error' && <p className="text-xs text-red-500 mt-3">失敗 Failed: {error}</p>}
      {status === 'done' && result && (
        <div className="mt-4 flex gap-4">
          <div>
            <p className="text-xs text-gray-400 mb-1">Full</p>
            <img src={result.url} alt="full" className="w-40 rounded border border-gray-200" />
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Thumb</p>
            <img src={result.thumbUrl} alt="thumb" className="w-24 rounded border border-gray-200" />
          </div>
        </div>
      )}
    </div>
  )
}

const SCREENS = [
  { key: 'locations', name: '地點', nameEn: 'Locations', href: '/inventory/lanterns/locations', ready: true },
  { key: 'list', name: '燈籠列表', nameEn: 'Lantern List', ready: false },
  { key: 'field', name: '現場模式', nameEn: 'Field Mode', ready: false },
  { key: 'admin', name: '管理', nameEn: 'Admin', ready: false },
]

function ScreenCard({ screen }) {
  const content = (
    <div
      className={`bg-white rounded-lg border p-5 transition-all ${
        screen.ready
          ? 'border-gray-200 cursor-pointer hover:border-blue-400 hover:shadow-sm'
          : 'border-gray-100 opacity-50 cursor-not-allowed'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-gray-900 text-sm">{screen.name}</h3>
        {!screen.ready && <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">即將推出</span>}
      </div>
      <p className="text-xs text-gray-400">{screen.nameEn}</p>
    </div>
  )
  return screen.ready ? <Link href={screen.href}>{content}</Link> : content
}

export default function LanternInventory() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const role = getInventoryRole(session?.user?.email)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/inventory')
    if (status === 'authenticated' && !role) router.replace('/')
  }, [status, role])

  if (status !== 'authenticated' || !role) return null

  return (
    <>
      <Head><title>燈籠庫存 · 庫存管理</title></Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center gap-3">
            <Link href="/inventory" className="text-gray-400 hover:text-gray-700 text-sm">← 庫存管理</Link>
            <div>
              <h1 className="font-semibold text-gray-900">燈籠庫存</h1>
              <p className="text-xs text-gray-500">Lantern Inventory</p>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-10 space-y-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {SCREENS.map((s) => <ScreenCard key={s.key} screen={s} />)}
          </div>
          <PhotoUploadTest />
        </main>
      </div>
    </>
  )
}
