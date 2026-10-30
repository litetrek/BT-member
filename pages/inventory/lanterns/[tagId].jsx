import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { getInventoryRole } from '@/lib/inventory'
import { uploadInventoryPhoto } from '@/lib/inventoryPhoto'
import ConfirmDialog from '@/components/ConfirmDialog'
import Spinner from '@/components/Spinner'
import InventoryQuickInspectSheet from '@/components/InventoryQuickInspectSheet'
import InventoryPhotoLightbox from '@/components/InventoryPhotoLightbox'
import InventoryHeader from '@/components/InventoryHeader'
import InventoryPhotoPicker from '@/components/InventoryPhotoPicker'
import { sortLanterns } from '@/lib/inventoryLanternSort'
import { loadListView, filtersToQuery, hasActiveFilters } from '@/lib/inventoryListView'

function Field({ label, value }) {
  return (
    <div>
      <p className="text-sm text-gray-400">{label}</p>
      <p className="text-base text-gray-900">{value ?? '—'}</p>
    </div>
  )
}

export default function LanternDetail() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { tagId } = router.query
  const role = getInventoryRole(session)
  const canEdit = role === 'admin' || role === 'editor'

  const [lantern, setLantern] = useState(null)
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showInspect, setShowInspect] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(null)
  // Prev/next lantern: tag IDs in the same order (and with the same filters) as 燈籠列表.
  const [order, setOrder] = useState(null) // { tags: string[], filtered: boolean }
  const touch = useRef(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/inventory')
    if (status === 'authenticated' && !role) router.replace('/')
  }, [status, role])

  function load() {
    if (!tagId) return
    setLoading(true)
    fetch(`/api/inventory/lanterns/${tagId}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null }
        return r.json()
      })
      .then((d) => { if (d) setLantern(d); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    if (status === 'authenticated' && role) load()
  }, [status, role, tagId])

  // Build the prev/next order once per visit (the page stays mounted while stepping between
  // lanterns). Uses the list's saved filters + sort; if this lantern isn't in that filtered
  // list (e.g. opened from 現場模式 or a QR scan), falls back to all lanterns, same sort.
  useEffect(() => {
    if (status !== 'authenticated' || !role || !tagId || order) return
    let cancelled = false
    ;(async () => {
      try {
        const view = loadListView()
        const sort = view?.sort
        const cats = await fetch('/api/inventory/categories').then((r) => r.json())
        const catIds = Array.isArray(cats) ? cats.map((c) => c.id) : []
        const fetchTags = async (filters) => {
          const rows = await fetch(`/api/inventory/lanterns?${filtersToQuery(filters)}`).then((r) => r.json())
          return sortLanterns(Array.isArray(rows) ? rows : [], sort, catIds).map((l) => l.tag_id)
        }
        let tags = await fetchTags(view?.filters)
        let filtered = hasActiveFilters(view?.filters)
        if (filtered && !tags.includes(tagId)) { tags = await fetchTags(null); filtered = false }
        if (!cancelled) setOrder({ tags, filtered })
      } catch { /* navigation is optional — the page works without it */ }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, role, tagId])

  // Moving to another lantern: close anything that belongs to the previous one.
  useEffect(() => {
    setLightboxIndex(null); setShowInspect(false); setConfirmDelete(false); setNotFound(false)
  }, [tagId])

  const pos = order ? order.tags.indexOf(tagId) : -1
  const prevTag = pos > 0 ? order.tags[pos - 1] : null
  const nextTag = pos >= 0 && pos < order.tags.length - 1 ? order.tags[pos + 1] : null
  const overlayOpen = lightboxIndex !== null || showInspect || confirmDelete

  // replace (not push): the browser's Back still returns to the list in one step.
  function goTo(tag) {
    if (tag) router.replace(`/inventory/lanterns/${tag}`, undefined, { scroll: true })
  }

  useEffect(() => {
    function onKey(e) {
      if (overlayOpen || e.altKey || e.ctrlKey || e.metaKey) return
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName)) return
      if (e.key === 'ArrowLeft') goTo(prevTag)
      if (e.key === 'ArrowRight') goTo(nextTag)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prevTag, nextTag, overlayOpen])

  // Swipe left = next lantern, swipe right = previous. Only a clearly horizontal, fairly
  // quick swipe counts, so normal scrolling never changes lanterns.
  function onTouchStart(e) {
    if (overlayOpen || e.touches.length !== 1) { touch.current = null; return }
    const t = e.touches[0]
    touch.current = { x: t.clientX, y: t.clientY, at: Date.now() }
  }
  function onTouchEnd(e) {
    const start = touch.current
    touch.current = null
    if (!start || overlayOpen) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6 || Date.now() - start.at > 800) return
    goTo(dx < 0 ? nextTag : prevTag)
  }

  useEffect(() => {
    if (status !== 'authenticated' || !role) return
    fetch('/api/inventory/locations').then((r) => r.json()).then((d) => setLocations(Array.isArray(d) ? d : []))
  }, [status, role])

  async function handleAddPhoto(files) {
    if (!files.length || !lantern) return
    setUploading(true)
    try {
      let hasPrimary = lantern.photos.some((p) => p.is_primary)
      for (const file of files) {
        const { url, thumbUrl } = await uploadInventoryPhoto(file, 'lantern', lantern.id)
        await fetch('/api/inventory/photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            owner_type: 'lantern', owner_id: lantern.id,
            url, thumb_url: thumbUrl, is_primary: !hasPrimary,
          }),
        })
        hasPrimary = true
      }
      load()
    } finally {
      setUploading(false)
    }
  }

  async function handleSetPrimary(photoId) {
    await fetch(`/api/inventory/photos/${photoId}`, { method: 'PUT' })
    load()
  }

  async function handleDeletePhoto(photoId) {
    await fetch(`/api/inventory/photos/${photoId}`, { method: 'DELETE' })
    load()
  }

  async function handleDeleteLantern() {
    await fetch(`/api/inventory/lanterns/${tagId}`, { method: 'DELETE' })
    router.push('/inventory/lanterns')
  }

  if (status !== 'authenticated' || !role) return null

  return (
    <>
      <Head><title>{tagId ?? '燈籠'} · 燈籠庫存</title></Head>
      <div className="min-h-screen bg-blue-50">
        <InventoryHeader
          icon="lantern"
          backHref="/inventory/lanterns"
          backLabel="燈籠列表"
          title={tagId}
          titleMono
          subtitle={lantern?.name_zh}
          right={canEdit && lantern && (
            <>
              <button onClick={() => setShowInspect(true)} className="text-base bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">
                記錄檢查
              </button>
              <Link href={`/inventory/lanterns/${tagId}/edit`} className="text-base bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-50">
                編輯
              </Link>
              {role === 'admin' && (
                <button onClick={() => setConfirmDelete(true)} className="text-base bg-white border border-red-300 text-red-600 px-3 py-1.5 rounded hover:bg-red-50">
                  刪除
                </button>
              )}
            </>
          )}
        />

        {order && pos >= 0 && order.tags.length > 1 && (
          <>
            <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-16 pt-4 flex items-center justify-between gap-2 text-sm">
              <button
                onClick={() => goTo(prevTag)}
                disabled={!prevTag}
                className="shrink-0 whitespace-nowrap px-3 py-1.5 rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-30"
              >
                ‹ 上一個
              </button>
              <span className="text-gray-500 text-center min-w-0">
                第 {pos + 1} / {order.tags.length} 筆{order.filtered ? ' · 已篩選' : ''}
                <span className="block text-xs text-gray-400 sm:hidden">← 左右滑動 Swipe →</span>
              </span>
              <button
                onClick={() => goTo(nextTag)}
                disabled={!nextTag}
                className="shrink-0 whitespace-nowrap px-3 py-1.5 rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-30"
              >
                下一個 ›
              </button>
            </div>
            {/* Side arrows on larger screens (PC / tablet); phones use swipe. */}
            {prevTag && (
              <button
                onClick={() => goTo(prevTag)}
                aria-label={`上一個 Previous: ${prevTag}`}
                title={prevTag}
                className="hidden md:flex fixed left-3 top-1/2 -translate-y-1/2 z-40 w-12 h-12 items-center justify-center rounded-full bg-white/90 border border-gray-200 shadow-md text-3xl text-gray-600 hover:bg-white hover:text-blue-600"
              >
                ‹
              </button>
            )}
            {nextTag && (
              <button
                onClick={() => goTo(nextTag)}
                aria-label={`下一個 Next: ${nextTag}`}
                title={nextTag}
                className="hidden md:flex fixed right-3 top-1/2 -translate-y-1/2 z-40 w-12 h-12 items-center justify-center rounded-full bg-white/90 border border-gray-200 shadow-md text-3xl text-gray-600 hover:bg-white hover:text-blue-600"
              >
                ›
              </button>
            )}
          </>
        )}

        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:px-16" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {loading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : notFound ? (
            <p className="text-base text-gray-400">找不到此燈籠。</p>
          ) : lantern ? (
            <div className="space-y-6">
              {!lantern.displayable && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-base rounded-lg px-4 py-2">
                  <p className="font-medium">不可展示 Not displayable</p>
                  {(lantern.displayable_reasons?.length ? lantern.displayable_reasons : ['布面或骨架損壞達門檻']).map((r) => (
                    <p key={r} className="text-sm">• {r}</p>
                  ))}
                </div>
              )}
              {lantern.status === 'Missing' && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-base rounded-lg px-4 py-2">
                  遺失 Missing — 找到後請在「記錄檢查」將狀態改回 Active
                </div>
              )}

              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-semibold text-gray-700">照片 Photos</h2>
                  {canEdit && (
                    uploading
                      ? <span className="text-sm text-gray-400">上傳中…</span>
                      : <InventoryPhotoPicker compact multiple onFiles={handleAddPhoto} />
                  )}
                </div>
                {lantern.photos.length === 0 ? (
                  <p className="text-base text-gray-400">尚無照片。</p>
                ) : (
                  // Main (主要) photo large — full-size image for sharpness — with the other photos
                  // as equal-size squares beside it (below it on phones). The API returns photos
                  // primary-first, so index 0 is the main one; lightbox indexes stay in that order.
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="sm:w-80 shrink-0">
                      <div className="relative">
                        <img
                          src={lantern.photos[0].url}
                          alt={lantern.name_zh}
                          onClick={() => setLightboxIndex(0)}
                          className="w-full aspect-square rounded-lg object-cover border-2 border-blue-500 cursor-pointer bg-gray-100"
                        />
                        <span className="absolute top-2 left-2 text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded">主要</span>
                      </div>
                      {canEdit && (
                        <div className="flex gap-2 mt-1">
                          <button onClick={() => handleDeletePhoto(lantern.photos[0].id)} className="text-xs text-gray-400 hover:text-red-600">刪除</button>
                        </div>
                      )}
                    </div>
                    {lantern.photos.length > 1 && (
                      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3 content-start flex-1">
                        {lantern.photos.slice(1).map((p, j) => (
                          <div key={p.id}>
                            <img
                              src={p.thumb_url}
                              alt=""
                              loading="lazy"
                              onClick={() => setLightboxIndex(j + 1)}
                              className="w-full aspect-square rounded object-cover border-2 border-transparent hover:border-gray-300 cursor-pointer bg-gray-100"
                            />
                            {canEdit && (
                              <div className="flex flex-wrap gap-x-2 mt-1">
                                <button onClick={() => handleSetPrimary(p.id)} className="text-xs text-gray-400 hover:text-blue-600">設為主要</button>
                                <button onClick={() => handleDeletePhoto(p.id)} className="text-xs text-gray-400 hover:text-red-600">刪除</button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Field label="名稱 Name" value={`${lantern.name_zh}${lantern.name_en ? ' / ' + lantern.name_en : ''}`} />
                <Field label="類別 Category" value={lantern.category_name_zh ? `${lantern.category_name_zh}${lantern.category_name_en ? ' / ' + lantern.category_name_en : ''}` : null} />
                <Field label="數量 QTY" value={lantern.qty} />
                <Field label="地點 Location" value={lantern.location_code ?? '未指定地點 Unassigned'} />
                <Field label="電壓 Voltage" value={lantern.voltage} />
                <Field label="功率 Power" value={lantern.power_w ? `${lantern.power_w} W` : null} />
                <Field label="尺寸 Dimensions (ft)" value={[lantern.height_ft, lantern.width_ft, lantern.depth_ft].some(Boolean) ? `${lantern.height_ft ?? '—'} × ${lantern.width_ft ?? '—'} × ${lantern.depth_ft ?? '—'}` : null} />
                <Field label="狀況 Condition" value={lantern.condition} />
                <Field label="布面損壞 Cloth damage" value={`${lantern.cloth_damage_pct}%`} />
                <Field label="骨架損壞 Frame damage" value={`${lantern.frame_damage_pct}%`} />
                <Field label="狀態 Status" value={lantern.status} />
                <Field label="展示決定 Display decision" value={lantern.display_decision} />
              </div>

              {lantern.notes && (
                <div className="bg-white rounded-lg border border-gray-200 p-5">
                  <p className="text-sm text-gray-400 mb-1">備註 Notes</p>
                  <p className="text-base text-gray-700 whitespace-pre-wrap">{lantern.notes}</p>
                </div>
              )}

              {lantern.inspections.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-5">
                  <h2 className="text-base font-semibold text-gray-700 mb-3">檢查歷史 Inspection History</h2>
                  <ul className="space-y-3">
                    {lantern.inspections.map((insp) => (
                      <li key={insp.id} className="text-sm border-l-2 border-blue-200 pl-3">
                        <p className="text-gray-700">
                          {new Date(insp.inspected_at).toLocaleString('zh-TW')} · {insp.inspected_by ?? '—'}
                        </p>
                        <p className="text-gray-500">
                          {insp.condition} · 布面 {insp.cloth_damage_pct}% · 骨架 {insp.frame_damage_pct}%
                          {insp.location_code ? ` · ${insp.location_code}` : ''}
                        </p>
                        {insp.notes && <p className="text-gray-400">{insp.notes}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {lantern.log.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-5">
                  <h2 className="text-base font-semibold text-gray-700 mb-3">歷史紀錄 History</h2>
                  <ul className="space-y-1.5">
                    {lantern.log.map((entry) => (
                      <li key={entry.id} className="text-sm text-gray-500">
                        {new Date(entry.created_at).toLocaleString('zh-TW')} · {entry.user_email ?? '—'} · {entry.action}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}
        </main>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          message="確定要刪除此燈籠記錄嗎？此操作無法復原。"
          onConfirm={handleDeleteLantern}
          onCancel={() => setConfirmDelete(false)}
        />
      )}

      {showInspect && lantern && (
        <InventoryQuickInspectSheet
          lantern={lantern}
          locations={locations}
          onClose={() => setShowInspect(false)}
          onSaved={() => { setShowInspect(false); load() }}
        />
      )}

      {lightboxIndex !== null && lantern && (
        <InventoryPhotoLightbox
          urls={lantern.photos.map((p) => p.url)}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  )
}
