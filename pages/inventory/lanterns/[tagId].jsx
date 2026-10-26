import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { getInventoryRole } from '@/lib/inventory'
import { uploadInventoryPhoto } from '@/lib/inventoryPhoto'
import ConfirmDialog from '@/components/ConfirmDialog'
import Spinner from '@/components/Spinner'
import InventoryQuickInspectSheet from '@/components/InventoryQuickInspectSheet'

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
  const role = getInventoryRole(session?.user?.email)
  const canEdit = role === 'admin' || role === 'editor'

  const [lantern, setLantern] = useState(null)
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showInspect, setShowInspect] = useState(false)

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

  useEffect(() => {
    if (status !== 'authenticated' || !role) return
    fetch('/api/inventory/locations').then((r) => r.json()).then((d) => setLocations(Array.isArray(d) ? d : []))
  }, [status, role])

  async function handleAddPhoto(e) {
    const files = Array.from(e.target.files ?? [])
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
      e.target.value = ''
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
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Link href="/inventory/lanterns" className="text-gray-400 hover:text-gray-700 text-base shrink-0">← 燈籠列表</Link>
              <div className="min-w-0">
                <h1 className="font-semibold text-gray-900 font-mono">{tagId}</h1>
                <p className="text-sm text-gray-500">{lantern?.name_zh}</p>
              </div>
            </div>
            {canEdit && lantern && (
              <div className="flex gap-2 shrink-0">
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
              </div>
            )}
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-8">
          {loading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : notFound ? (
            <p className="text-base text-gray-400">找不到此燈籠。</p>
          ) : lantern ? (
            <div className="space-y-6">
              {!lantern.displayable && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-base rounded-lg px-4 py-2">
                  不可展示 Not displayable（布面或骨架損壞達門檻）
                </div>
              )}

              <div className="bg-white rounded-lg border border-gray-200 p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Field label="名稱 Name" value={`${lantern.name_zh}${lantern.name_en ? ' / ' + lantern.name_en : ''}`} />
                <Field label="類別 Category" value={lantern.category_name_zh} />
                <Field label="數量 QTY" value={lantern.qty} />
                <Field label="地點 Location" value={lantern.location_code} />
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

              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-semibold text-gray-700">照片 Photos</h2>
                  {canEdit && (
                    <label className="text-sm text-blue-600 cursor-pointer hover:underline">
                      {uploading ? '上傳中…' : '+ 新增照片'}
                      <input type="file" accept="image/*" multiple onChange={handleAddPhoto} className="hidden" disabled={uploading} />
                    </label>
                  )}
                </div>
                {lantern.photos.length === 0 ? (
                  <p className="text-base text-gray-400">尚無照片。</p>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {lantern.photos.map((p) => (
                      <div key={p.id} className="relative">
                        <img src={p.thumb_url} alt="" className={`w-24 h-24 rounded object-cover border-2 ${p.is_primary ? 'border-blue-500' : 'border-transparent'}`} />
                        {p.is_primary && <span className="absolute top-1 left-1 text-xs bg-blue-600 text-white px-1 rounded">主要</span>}
                        {canEdit && (
                          <div className="flex gap-1 mt-1">
                            {!p.is_primary && (
                              <button onClick={() => handleSetPrimary(p.id)} className="text-xs text-gray-400 hover:text-blue-600">設為主要</button>
                            )}
                            <button onClick={() => handleDeletePhoto(p.id)} className="text-xs text-gray-400 hover:text-red-600">刪除</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

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
    </>
  )
}
