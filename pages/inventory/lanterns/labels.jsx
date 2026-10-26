import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { getInventoryRole } from '@/lib/inventory'
import { lanternQrUrl, generateQrDataUrl } from '@/lib/inventoryQr'
import InventoryLanternNav from '@/components/InventoryLanternNav'
import InventoryHeader from '@/components/InventoryHeader'
import Spinner from '@/components/Spinner'

const SIZE_PRESETS = [
  { key: 'sm', label: '2 × 1 in', widthIn: 2, heightIn: 1 },
  { key: 'md', label: '2.5 × 1.5 in', widthIn: 2.5, heightIn: 1.5 },
  { key: 'lg', label: '3 × 2 in', widthIn: 3, heightIn: 2 },
]

export default function Labels() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const role = getInventoryRole(session)
  const canUse = role === 'admin' || role === 'editor'

  const [lanterns, setLanterns] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(new Set())
  const [sizeKey, setSizeKey] = useState('md')
  const [qrUrls, setQrUrls] = useState({}) // tag_id -> data url
  const [marking, setMarking] = useState(false)
  const [onlyUnattached, setOnlyUnattached] = useState(false)

  const size = SIZE_PRESETS.find((s) => s.key === sizeKey)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/inventory')
    if (status === 'authenticated' && !canUse) router.replace('/inventory/lanterns')
  }, [status, canUse])

  function load() {
    setLoading(true)
    fetch('/api/inventory/lanterns')
      .then((r) => r.json())
      .then((d) => { setLanterns(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    if (status === 'authenticated' && canUse) load()
  }, [status, canUse])

  const visible = onlyUnattached ? lanterns.filter((l) => !l.label_attached) : lanterns

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === visible.length ? new Set() : new Set(visible.map((l) => l.id))))
  }

  const selectedLanterns = lanterns.filter((l) => selected.has(l.id))

  useEffect(() => {
    let cancelled = false
    async function run() {
      for (const lt of selectedLanterns) {
        if (qrUrls[lt.tag_id]) continue
        const dataUrl = await generateQrDataUrl(lanternQrUrl(lt.tag_id))
        if (!cancelled) setQrUrls((prev) => ({ ...prev, [lt.tag_id]: dataUrl }))
      }
    }
    run()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  async function handleMarkAttached() {
    setMarking(true)
    for (const lt of selectedLanterns) {
      await fetch(`/api/inventory/lanterns/${lt.tag_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label_attached: true }),
      })
    }
    setMarking(false)
    load()
  }

  if (status !== 'authenticated' || !canUse) return null

  return (
    <>
      <Head><title>標籤 · 燈籠庫存</title></Head>
      <div className="min-h-screen bg-gray-50 print:bg-white">
        <InventoryHeader icon="tag" backHref="/inventory/lanterns" backLabel="燈籠列表" title="標籤" subtitle="Labels — QR + Tag ID" printHidden />

        <InventoryLanternNav active="labels" />

        <main className="max-w-6xl mx-auto px-6 py-8 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={onlyUnattached} onChange={(e) => setOnlyUnattached(e.target.checked)} />
              只顯示尚未貼標籤 Only unattached
            </label>
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-500">
                標籤尺寸
                <select value={sizeKey} onChange={(e) => setSizeKey(e.target.value)} className="ml-2 border border-gray-200 rounded px-2 py-1 text-sm">
                  {SIZE_PRESETS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </label>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : (
            <>
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
                <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 border-b border-gray-200 text-sm">
                  <input type="checkbox" checked={selected.size > 0 && selected.size === visible.length} onChange={toggleAll} />
                  <span className="text-gray-500">全選 Select all ({visible.length})</span>
                </div>
                <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
                  {visible.map((lt) => (
                    <label key={lt.id} className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-gray-50">
                      <input type="checkbox" checked={selected.has(lt.id)} onChange={() => toggleOne(lt.id)} />
                      <span className="font-mono text-sm text-gray-400 w-20 shrink-0">{lt.tag_id}</span>
                      <span className="text-base text-gray-900 flex-1 truncate">{lt.name_zh}</span>
                      <span className="text-sm text-gray-400">QTY {lt.qty}</span>
                      {lt.label_attached && <span className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded">已貼標籤</span>}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 sticky bottom-4">
                <button
                  onClick={() => window.print()}
                  disabled={selected.size === 0}
                  className="px-4 py-2 text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  列印標籤 Print ({selected.size})
                </button>
                <button
                  onClick={handleMarkAttached}
                  disabled={selected.size === 0 || marking}
                  className="px-4 py-2 text-base bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-50"
                >
                  {marking ? '處理中…' : '標記已貼標籤'}
                </button>
              </div>
            </>
          )}
        </main>

        {/* Print-only label sheet — invisible on screen, shown only by @media print via Tailwind's print: variant */}
        <div className="hidden print:flex print:flex-wrap print:gap-2 print:p-2">
          {selectedLanterns.map((lt) =>
            Array.from({ length: lt.qty || 1 }, (_, i) => (
              <div
                key={`${lt.id}-${i}`}
                className="flex items-center gap-2 border border-gray-400 p-2 break-inside-avoid"
                style={{ width: `${size.widthIn}in`, height: `${size.heightIn}in` }}
              >
                {qrUrls[lt.tag_id] && (
                  <img src={qrUrls[lt.tag_id]} alt="" className="shrink-0" style={{ width: `${size.heightIn - 0.3}in`, height: `${size.heightIn - 0.3}in` }} />
                )}
                <div className="min-w-0">
                  <p className="font-mono font-bold text-lg leading-tight">{lt.tag_id}</p>
                  <p className="text-xs truncate">{lt.name_zh}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}
