import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { getInventoryRole } from '@/lib/inventory'
import { CONDITION_OPTIONS, VOLTAGE_OPTIONS, STATUS_OPTIONS } from '@/lib/inventoryConstants'
import InventoryLanternNav from '@/components/InventoryLanternNav'
import Spinner from '@/components/Spinner'

const EMPTY_FILTERS = { q: '', category_id: '', location_id: '', voltage: '', condition: '', status: '', displayable: '' }

function LanternCard({ lantern }) {
  return (
    <Link href={`/inventory/lanterns/${lantern.tag_id}`}>
      <div className="bg-white rounded-lg border border-gray-200 p-3 flex gap-3 items-center cursor-pointer hover:border-blue-400 hover:shadow-sm transition-all">
        {lantern.primary_photo_thumb_url ? (
          <img src={lantern.primary_photo_thumb_url} alt={lantern.tag_id} className="w-14 h-14 rounded object-cover shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded bg-gray-100 shrink-0 flex items-center justify-center text-gray-300 text-sm">無照片</div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-mono text-sm text-gray-400">{lantern.tag_id}</p>
            {!lantern.displayable && (
              <span className="text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded">不可展示</span>
            )}
          </div>
          <p className="font-semibold text-gray-900 text-base truncate">{lantern.name_zh}</p>
          <p className="text-sm text-gray-400 truncate">
            {lantern.category_name_zh ?? '—'} · QTY {lantern.qty} · {lantern.location_code ?? '—'}
          </p>
        </div>
        <span className="text-sm text-gray-500 shrink-0">{lantern.condition}</span>
      </div>
    </Link>
  )
}

export default function LanternList() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const role = getInventoryRole(session?.user?.email)

  const [lanterns, setLanterns] = useState([])
  const [categories, setCategories] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState(EMPTY_FILTERS)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/inventory')
    if (status === 'authenticated' && !role) router.replace('/')
  }, [status, role])

  useEffect(() => {
    if (status !== 'authenticated' || !role) return
    fetch('/api/inventory/categories').then((r) => r.json()).then((d) => setCategories(Array.isArray(d) ? d : []))
    fetch('/api/inventory/locations').then((r) => r.json()).then((d) => setLocations(Array.isArray(d) ? d : []))
  }, [status, role])

  useEffect(() => {
    if (status !== 'authenticated' || !role) return
    setLoading(true)
    const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v !== ''))
    fetch(`/api/inventory/lanterns?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => { setLanterns(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [status, role, filters])

  const summary = useMemo(() => {
    const totalQty = lanterns.reduce((sum, l) => sum + (l.qty ?? 0), 0)
    const byCondition = CONDITION_OPTIONS.reduce((acc, c) => {
      acc[c] = lanterns.filter((l) => l.condition === c).length
      return acc
    }, {})
    return { totalRecords: lanterns.length, totalQty, byCondition }
  }, [lanterns])

  if (status !== 'authenticated' || !role) return null

  const selectCls = 'border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400'

  return (
    <>
      <Head><title>燈籠列表 · 燈籠庫存</title></Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Link href="/inventory" className="text-gray-400 hover:text-gray-700 text-base shrink-0">← 庫存管理</Link>
              <div className="min-w-0">
                <h1 className="font-semibold text-gray-900">燈籠庫存</h1>
                <p className="text-sm text-gray-500">Lantern Inventory</p>
              </div>
            </div>
            {['admin', 'editor'].includes(role) && (
              <Link href="/inventory/lanterns/new" className="text-base bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 shrink-0">
                + 新增燈籠
              </Link>
            )}
          </div>
        </header>

        <InventoryLanternNav active="list" />

        <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-wrap gap-3 items-center text-sm text-gray-600">
            <span>總記錄 {summary.totalRecords}</span>
            <span className="text-gray-300">|</span>
            <span>總數量 {summary.totalQty}</span>
            <span className="text-gray-300">|</span>
            {CONDITION_OPTIONS.map((c) => (
              <span key={c}>{c} {summary.byCondition[c]}</span>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              placeholder="搜尋標籤或名稱 Search tag or name"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              className={`${selectCls} w-48`}
            />
            <select value={filters.category_id} onChange={(e) => setFilters((f) => ({ ...f, category_id: e.target.value }))} className={selectCls}>
              <option value="">所有類別</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name_zh}</option>)}
            </select>
            <select value={filters.location_id} onChange={(e) => setFilters((f) => ({ ...f, location_id: e.target.value }))} className={selectCls}>
              <option value="">所有地點</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.code}</option>)}
            </select>
            <select value={filters.voltage} onChange={(e) => setFilters((f) => ({ ...f, voltage: e.target.value }))} className={selectCls}>
              <option value="">所有電壓</option>
              {VOLTAGE_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <select value={filters.condition} onChange={(e) => setFilters((f) => ({ ...f, condition: e.target.value }))} className={selectCls}>
              <option value="">所有狀況</option>
              {CONDITION_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} className={selectCls}>
              <option value="">所有狀態</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filters.displayable} onChange={(e) => setFilters((f) => ({ ...f, displayable: e.target.value }))} className={selectCls}>
              <option value="">可/不可展示</option>
              <option value="true">可展示</option>
              <option value="false">不可展示</option>
            </select>
            {JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS) && (
              <button onClick={() => setFilters(EMPTY_FILTERS)} className="text-sm text-gray-400 hover:text-gray-700 px-2">
                清除篩選
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : lanterns.length === 0 ? (
            <p className="text-base text-gray-400">尚無燈籠記錄。</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {lanterns.map((l) => <LanternCard key={l.id} lantern={l} />)}
            </div>
          )}
        </main>
      </div>
    </>
  )
}
