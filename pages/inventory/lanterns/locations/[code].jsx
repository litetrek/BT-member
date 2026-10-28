import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { getInventoryRole } from '@/lib/inventory'
import InventoryLocationForm from '@/components/InventoryLocationForm'
import InventoryLanternNav from '@/components/InventoryLanternNav'
import InventoryPhotoLightbox from '@/components/InventoryPhotoLightbox'
import InventoryHeader from '@/components/InventoryHeader'
import Spinner from '@/components/Spinner'
import ConfirmDialog from '@/components/ConfirmDialog'
import { UNASSIGNED_LOCATION_CODE, formatLocationCounts, summarizeLanterns } from '@/lib/inventoryConstants'

export default function LocationDetail() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { code } = router.query
  const role = getInventoryRole(session)
  const isUnassigned = code === UNASSIGNED_LOCATION_CODE

  const [location, setLocation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showPhoto, setShowPhoto] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  async function handleDelete() {
    setConfirmDelete(false)
    setDeleteError('')
    const res = await fetch(`/api/inventory/locations/${code}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/inventory/lanterns/locations')
    } else {
      setDeleteError((await res.json().catch(() => ({}))).error || '刪除失敗')
    }
  }

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
      <Head><title>{isUnassigned ? '未指定地點' : (code ?? '地點')} · 燈籠庫存</title></Head>
      <div className="min-h-screen bg-gray-50">
        <InventoryHeader
          icon="pin"
          backHref="/inventory/lanterns/locations"
          backLabel="地點"
          title={isUnassigned ? '未指定地點' : code}
          subtitle={location ? (isUnassigned ? 'Unassigned' : (/^[A-Z]$/.test(location.zone) ? `${location.zone} 區` : location.zone)) : ''}
          right={role === 'admin' && location && !isUnassigned && (
            <div className="flex gap-2">
              <button onClick={() => setShowEdit(true)} className="text-base bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-50">
                編輯
              </button>
              {location.lanterns.length === 0 && (
                <button onClick={() => setConfirmDelete(true)} className="text-base bg-white border border-red-300 text-red-600 px-3 py-1.5 rounded hover:bg-red-50">
                  刪除
                </button>
              )}
            </div>
          )}
        />

        <InventoryLanternNav active="locations" />

        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          {loading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : notFound ? (
            <p className="text-base text-gray-400">找不到此地點。</p>
          ) : location ? (
            <div className="space-y-6">
              {deleteError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-base rounded-lg px-4 py-2">{deleteError}</div>
              )}
              {isUnassigned ? (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-base rounded-lg px-4 py-3">
                  這些燈籠尚未指定存放地點。請在燈籠頁「編輯」或「記錄檢查」中設定地點。
                  <span className="block text-sm text-amber-700">These lanterns have no location yet — set one via Edit or Record Inspection.</span>
                </div>
              ) : (
              <div className="bg-white rounded-lg border border-gray-200 p-5 flex gap-5">
                {location.photo_url ? (
                  <img
                    src={location.photo_url}
                    alt={location.code}
                    onClick={() => setShowPhoto(true)}
                    className="w-32 h-32 rounded object-cover shrink-0 cursor-pointer"
                  />
                ) : (
                  <div className="w-32 h-32 rounded bg-gray-100 shrink-0 flex items-center justify-center text-gray-300 text-sm">
                    無照片
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-base text-gray-700 whitespace-pre-wrap">{location.description || '尚無說明'}</p>
                </div>
              </div>
              )}

              <div>
                <h2 className="text-base font-semibold text-gray-700 mb-3">
                  此處燈籠 Lanterns here（{formatLocationCounts(summarizeLanterns(location.lanterns).records, summarizeLanterns(location.lanterns).qty)}）
                </h2>
                {location.lanterns.length === 0 ? (
                  <p className="text-base text-gray-400">尚無燈籠存放於此。</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {location.lanterns.map((lt) => (
                      <Link key={lt.id} href={`/inventory/lanterns/${lt.tag_id}`}>
                        <div className="bg-white rounded-lg border border-gray-200 p-3 cursor-pointer hover:border-blue-400 hover:shadow-sm transition-all">
                          <p className="font-semibold text-gray-900 text-base">{lt.tag_id} — {lt.name_zh}</p>
                          <p className="text-sm text-gray-400">{lt.condition} · QTY {lt.qty}</p>
                        </div>
                      </Link>
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

      {confirmDelete && location && (
        <ConfirmDialog
          message={`確定要刪除地點 ${location.code} 嗎？此操作無法復原。`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}

      {showPhoto && location?.photo_url && (
        <InventoryPhotoLightbox
          urls={[location.photo_url]}
          onClose={() => setShowPhoto(false)}
        />
      )}
    </>
  )
}
