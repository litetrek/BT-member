import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { getInventoryRole } from '@/lib/inventory'
import { CONDITION_OPTIONS, VOLTAGE_OPTIONS, STATUS_OPTIONS, UNASSIGNED_FILTER_VALUE, UNASSIGNED_LABEL, LANTERN_WHATS_NEW_URL } from '@/lib/inventoryConstants'
import InventoryDisplayableBadge from '@/components/InventoryDisplayableBadge'
import { sortLanterns, LANTERN_SORT_OPTIONS, DEFAULT_LANTERN_SORT } from '@/lib/inventoryLanternSort'
import { EMPTY_FILTERS, loadListView as loadView, saveListView as saveView, filtersToQuery } from '@/lib/inventoryListView'
import InventoryLanternNav from '@/components/InventoryLanternNav'
import InventoryHeader from '@/components/InventoryHeader'
import Spinner from '@/components/Spinner'

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
            {!lantern.displayable && <InventoryDisplayableBadge reasons={lantern.displayable_reasons} />}
            {lantern.status && lantern.status !== 'Active' && (
              <span className="text-xs text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{lantern.status === 'Missing' ? '遺失 Missing' : '退役 Retired'}</span>
            )}
          </div>
          <p className="font-semibold text-gray-900 text-base truncate">{lantern.name_zh}</p>
          {lantern.name_en && lantern.name_en !== lantern.name_zh && (
            <p className="text-sm text-gray-600 truncate">{lantern.name_en}</p>
          )}
          <p className="text-sm text-gray-400 truncate">
            {lantern.category_name_zh ?? '—'} · QTY {lantern.qty} · {lantern.location_code ?? '未指定地點'}
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
  const role = getInventoryRole(session)

  const [lanterns, setLanterns] = useState([])
  const [categories, setCategories] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [sort, setSort] = useState(DEFAULT_LANTERN_SORT)
  const [viewReady, setViewReady] = useState(false) // don't fetch until the saved view is restored

  // Restore the saved filters/sort; deep links such as /inventory/lanterns?location_id=none
  // (Unassigned) replace the saved filters instead of being mixed with them.
  useEffect(() => {
    if (!router.isReady) return
    const saved = loadView()
    const fromUrl = Object.fromEntries(Object.keys(EMPTY_FILTERS).filter((k) => typeof router.query[k] === 'string').map((k) => [k, router.query[k]]))
    if (Object.keys(fromUrl).length) setFilters({ ...EMPTY_FILTERS, ...fromUrl })
    else if (saved) setFilters(saved.filters)
    if (saved) setSort(saved.sort)
    setViewReady(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady])

  useEffect(() => {
    if (viewReady) saveView(filters, sort)
  }, [viewReady, filters, sort])

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/inventory')
    if (status === 'authenticated' && !role) router.replace('/')
  }, [status, role])

  useEffect(() => {
    if (status !== 'authenticated' || !role) return
    fetch('/api/inventory/categories').then((r) => r.json()).then((d) => setCategories(Array.isArray(d) ? d : []))
    fetch('/api/inventory/locations').then((r) => r.json()).then((d) => setLocations(Array.isArray(d) ? d : []))
  }, [status, role])

  // A remembered category/location that has since been deleted would filter silently
  // while the dropdown shows something else — drop it once the options are known.
  useEffect(() => {
    if (!viewReady) return
    setFilters((f) => {
      let next = f
      if (f.category_id && categories.length && !categories.some((c) => String(c.id) === f.category_id)) next = { ...next, category_id: '' }
      if (f.location_id && f.location_id !== UNASSIGNED_FILTER_VALUE && locations.length && !locations.some((l) => String(l.id) === f.location_id)) next = { ...next, location_id: '' }
      return next
    })
  }, [viewReady, categories, locations])

  useEffect(() => {
    if (status !== 'authenticated' || !role || !viewReady) return
    setLoading(true)
    fetch(`/api/inventory/lanterns?${filtersToQuery(filters)}`)
      .then((r) => r.json())
      .then((d) => { setLanterns(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [status, role, filters, viewReady])

  const sortedLanterns = useMemo(
    () => sortLanterns(lanterns, sort, categories.map((c) => c.id)),
    [lanterns, sort, categories]
  )

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
        <InventoryHeader
          icon="lantern"
          backHref="/inventory"
          backLabel="庫存管理"
          title="燈籠庫存"
          subtitle="Lantern Inventory"
          right={(
            <>
              <a
                href={LANTERN_WHATS_NEW_URL}
                className="text-base bg-amber-50 border border-amber-300 text-amber-800 px-3 py-1.5 rounded hover:bg-amber-100 whitespace-nowrap"
              >
                新功能說明
              </a>
              {['admin', 'editor'].includes(role) && (
                <Link href="/inventory/lanterns/new" className="text-base bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 whitespace-nowrap">
                  + 新增燈籠
                </Link>
              )}
            </>
          )}
        />

        <InventoryLanternNav active="list" />

        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
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
              type="search"
              placeholder="搜尋 編號/名稱 Search"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              className={`${selectCls} w-full sm:w-60`}
            />
            <select value={filters.category_id} onChange={(e) => setFilters((f) => ({ ...f, category_id: e.target.value }))} className={selectCls}>
              <option value="">所有類別</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name_zh}</option>)}
            </select>
            <select value={filters.location_id} onChange={(e) => setFilters((f) => ({ ...f, location_id: e.target.value }))} className={selectCls}>
              <option value="">所有地點</option>
              <option value={UNASSIGNED_FILTER_VALUE}>{UNASSIGNED_LABEL}</option>
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
            <select aria-label="排序 Sort" value={sort} onChange={(e) => setSort(e.target.value)} className={`${selectCls} bg-blue-50 border-blue-200`}>
              {LANTERN_SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
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
              {sortedLanterns.map((l) => <LanternCard key={l.id} lantern={l} />)}
            </div>
          )}
        </main>
      </div>
    </>
  )
}
