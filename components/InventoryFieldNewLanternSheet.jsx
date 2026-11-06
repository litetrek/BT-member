import { useEffect, useState } from 'react'
import { uploadInventoryPhoto } from '@/lib/inventoryPhoto'
import { saveDraft, loadDraft, clearDraft, markChecked } from '@/lib/inventoryFieldDraft'
import { CONDITION_OPTIONS, VOLTAGE_OPTIONS } from '@/lib/inventoryConstants'
import InventoryPhotoPicker from '@/components/InventoryPhotoPicker'
import InventoryLanternNameFields from '@/components/InventoryLanternNameFields'
import InventoryRepairEaseSlider from '@/components/InventoryRepairEaseSlider'
import InventoryBaseTypePicker from '@/components/InventoryBaseTypePicker'

// Field mode's "+ New lantern" flow: photos first (per spec), then fields, then the
// auto-assigned tag ID shown large so it can go straight on a temporary label.
// Several photos can be taken: on the photo step (拍照 again for each), added while
// filling in the details, and added after saving on the tag-ID screen (uploaded right
// away to the new lantern). The first photo becomes the 主要 (primary) photo.
export default function InventoryFieldNewLanternSheet({ fixedLocationId, locationCode, categories, onClose, onSaved }) {
  const draftKey = `newlantern:${locationCode}`
  const draft = loadDraft(draftKey)

  const [step, setStep] = useState('photo') // photo | details | done
  const [photos, setPhotos] = useState([]) // [{ file, preview }] — not uploaded yet; [0] = primary
  const [created, setCreated] = useState(null) // the saved lantern, once POST succeeds
  const [uploaded, setUploaded] = useState([]) // preview URLs of photos already on the lantern
  const [uploadingMore, setUploadingMore] = useState(false)
  const [photoWarning, setPhotoWarning] = useState('')
  const [form, setForm] = useState({
    name_zh: draft?.name_zh ?? '',
    name_en: draft?.name_en ?? '',
    category_id: draft?.category_id ?? '',
    qty: draft?.qty ?? 1,
    voltage: draft?.voltage ?? '',
    power_w: draft?.power_w ?? '',
    height_ft: draft?.height_ft ?? '',
    width_ft: draft?.width_ft ?? '',
    depth_ft: draft?.depth_ft ?? '',
    base_type: draft?.base_type ?? null, // 底座; null = 未填
    condition: draft?.condition ?? '', // must be chosen before saving
    cloth_damage_pct: draft?.cloth_damage_pct ?? 0,
    frame_damage_pct: draft?.frame_damage_pct ?? 0,
    repair_ease: draft?.repair_ease ?? null, // 0–5; null = 未評估
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [createdTag, setCreatedTag] = useState(null)

  useEffect(() => {
    if (step === 'details') saveDraft(draftKey, form)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, step])

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function addPhotos(files) {
    setPhotos((prev) => [...prev, ...files.map((file) => ({ file, preview: URL.createObjectURL(file) }))])
  }

  function removePhoto(i) {
    setPhotos((prev) => prev.filter((_, j) => j !== i))
  }

  // Uploads files to the saved lantern one by one; returns the ones that failed.
  async function uploadToLantern(lanternId, items, firstIsPrimary) {
    const failed = []
    for (let i = 0; i < items.length; i++) {
      try {
        const { url, thumbUrl } = await uploadInventoryPhoto(items[i].file, 'lantern', lanternId)
        const res = await fetch('/api/inventory/photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            owner_type: 'lantern', owner_id: lanternId, url, thumb_url: thumbUrl,
            is_primary: firstIsPrimary && i === 0,
          }),
        })
        if (!res.ok) throw new Error('save failed')
        setUploaded((prev) => [...prev, items[i].preview])
      } catch {
        failed.push(items[i])
      }
    }
    return failed
  }

  // On the tag-ID screen: more photos go straight onto the saved lantern.
  async function handleAddAfterSave(files) {
    if (!created || !files.length) return
    setUploadingMore(true)
    setPhotoWarning('')
    const items = files.map((file) => ({ file, preview: URL.createObjectURL(file) }))
    const failed = await uploadToLantern(created.id, items, uploaded.length === 0)
    if (failed.length) setPhotoWarning(`${failed.length} 張照片上傳失敗，請再試一次 Upload failed — try again`)
    setUploadingMore(false)
  }

  async function handleSubmit() {
    setSaving(true)
    setError('')
    try {
      const body = {
        ...form,
        name_zh: form.name_zh.trim(),
        name_en: form.name_en.trim() || null,
        category_id: form.category_id || null,
        voltage: form.voltage || null,
        power_w: form.power_w === '' ? null : form.power_w,
        height_ft: form.height_ft === '' ? null : form.height_ft,
        width_ft: form.width_ft === '' ? null : form.width_ft,
        depth_ft: form.depth_ft === '' ? null : form.depth_ft,
        qty: Number(form.qty) || 1,
        cloth_damage_pct: Number(form.cloth_damage_pct),
        frame_damage_pct: Number(form.frame_damage_pct),
        repair_ease: form.repair_ease,
        location_id: fixedLocationId,
      }
      const res = await fetch('/api/inventory/lanterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.json()).error || '儲存失敗')
      const lantern = await res.json()

      // The lantern exists from here on: always move to the tag-ID screen, even if some
      // photos fail (retrying 儲存 would create a duplicate lantern). Failed photos can be
      // added again on that screen.
      clearDraft(draftKey)
      markChecked(locationCode, lantern.id)
      setCreated(lantern)
      setCreatedTag(lantern.tag_id)
      setStep('done')
      const failed = await uploadToLantern(lantern.id, photos, true)
      if (failed.length) setPhotoWarning(`${failed.length} 張照片上傳失敗，請用下面的按鈕再加 Some photos failed — add them again below`)
      setPhotos([])
      setSaving(false)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  function handleDone() {
    onSaved()
  }

  const inputCls = 'w-full border border-gray-200 rounded px-3 py-2 text-base focus:outline-none focus:ring-1 focus:ring-blue-400'

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-end sm:items-center sm:justify-center">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto p-6 space-y-5">
        {step === 'photo' && (
          <>
            <h2 className="font-semibold text-gray-900 text-lg">新增燈籠 New Lantern</h2>
            <p className="text-sm text-gray-500">先拍照，可以拍多張 Take one or more photos first</p>
            {photos.length ? (
              <PhotoGrid photos={photos} onRemove={removePhoto} large />
            ) : (
              <div className="w-full h-48 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300 text-sm">
                尚未拍照
              </div>
            )}
            {photos.length > 0 && <p className="text-sm text-gray-500">已選 {photos.length} 張 · 第一張為主要照片。再按「拍照」可繼續加。</p>}
            <InventoryPhotoPicker multiple onFiles={addPhotos} />
            <div className="sticky bottom-0 bg-white pt-2 flex gap-2">
              <button onClick={onClose} className="flex-1 py-3 text-base text-gray-600 border border-gray-200 rounded-lg">取消</button>
              <button
                onClick={() => setStep('details')}
                disabled={!photos.length}
                className="flex-1 py-3 text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                繼續 Continue
              </button>
            </div>
          </>
        )}

        {step === 'details' && (
          <>
            <h2 className="font-semibold text-gray-900 text-lg">燈籠資料 Details</h2>
            <div className="flex items-center justify-between rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
              <span className="text-sm text-gray-500">地點 Location</span>
              <span className="text-base font-semibold text-blue-800">{locationCode}</span>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">照片 Photos（{photos.length}）</span>
                <InventoryPhotoPicker compact multiple onFiles={addPhotos} />
              </div>
              <PhotoGrid photos={photos} onRemove={removePhoto} />
            </div>
            <InventoryLanternNameFields
              nameZh={form.name_zh}
              nameEn={form.name_en}
              onChange={update}
              inputCls={inputCls}
              labelCls="block text-sm text-gray-500 mb-1"
              stacked
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-500 mb-1">類別 Category</label>
                <select value={form.category_id} onChange={(e) => update('category_id', e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  {categories?.map((c) => <option key={c.id} value={c.id}>{c.name_zh}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">數量 QTY</label>
                <input type="number" min="1" value={form.qty} onChange={(e) => update('qty', e.target.value)} className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-500 mb-1">電壓 Voltage</label>
                <select value={form.voltage} onChange={(e) => update('voltage', e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  {VOLTAGE_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">功率 Power (W)</label>
                <input type="number" step="0.01" value={form.power_w} onChange={(e) => update('power_w', e.target.value)} className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm text-gray-500 mb-1">高 H (ft)</label>
                <input type="number" step="0.01" value={form.height_ft} onChange={(e) => update('height_ft', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">寬 W (ft)</label>
                <input type="number" step="0.01" value={form.width_ft} onChange={(e) => update('width_ft', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">深 D (ft)</label>
                <input type="number" step="0.01" value={form.depth_ft} onChange={(e) => update('depth_ft', e.target.value)} className={inputCls} />
              </div>
            </div>
            <InventoryBaseTypePicker value={form.base_type} onChange={(v) => update('base_type', v)} />

            <div>
              <p className="text-sm text-gray-500 mb-2">狀況 Condition {!form.condition && <span className="text-red-500">（請選擇）</span>}</p>
              <div className="grid grid-cols-4 gap-2">
                {CONDITION_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => update('condition', c)}
                    className={`py-3 rounded-lg text-sm font-medium border-2 transition-colors ${
                      form.condition === c ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm text-gray-500 mb-1">
                <span>布面損壞 Cloth damage</span><span>{form.cloth_damage_pct}%</span>
              </div>
              <input type="range" min="0" max="100" step="5" value={form.cloth_damage_pct} onChange={(e) => update('cloth_damage_pct', e.target.value)} className="w-full" />
            </div>
            <div>
              <div className="flex justify-between text-sm text-gray-500 mb-1">
                <span>骨架損壞 Frame damage</span><span>{form.frame_damage_pct}%</span>
              </div>
              <input type="range" min="0" max="100" step="5" value={form.frame_damage_pct} onChange={(e) => update('frame_damage_pct', e.target.value)} className="w-full" />
            </div>
            <InventoryRepairEaseSlider value={form.repair_ease} onChange={(v) => update('repair_ease', v)} />

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="sticky bottom-0 bg-white pt-2 flex gap-2">
              <button onClick={() => setStep('photo')} className="flex-1 py-3 text-base text-gray-600 border border-gray-200 rounded-lg">返回</button>
              <button
                onClick={handleSubmit}
                disabled={saving || !form.name_zh.trim() || !form.condition}
                className="flex-1 py-3 text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? '儲存中…' : '儲存'}
              </button>
            </div>
          </>
        )}

        {step === 'done' && (
          <div className="text-center py-6 space-y-4">
            <p className="text-sm text-gray-500">標籤編號 Tag ID</p>
            <p className="text-5xl font-bold text-blue-700 font-mono">{createdTag}</p>
            <p className="text-sm text-gray-500">請立即寫在臨時標籤上<br />Write this on a temporary label now</p>

            <div className="text-left border-t border-gray-100 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  照片 Photos（{uploaded.length}）{(saving || uploadingMore) && <span className="text-blue-600"> 上傳中…</span>}
                </span>
              </div>
              {uploaded.length > 0 && <PhotoGrid photos={uploaded.map((preview) => ({ preview }))} />}
              <p className="text-sm text-gray-500">還要補拍嗎？照片會直接加到 {createdTag}。<span className="block text-xs text-gray-400">Need more photos? They are added to this lantern right away.</span></p>
              <InventoryPhotoPicker multiple onFiles={handleAddAfterSave} disabled={saving || uploadingMore} />
              {photoWarning && <p className="text-sm text-red-500">{photoWarning}</p>}
            </div>

            <button onClick={handleDone} disabled={saving || uploadingMore} className="w-full py-3 text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving || uploadingMore ? '照片上傳中…' : '完成 Done'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// Thumbnails of photos picked in this sheet. [0] gets the 主要 badge; × removes one
// (only before saving — after saving, photos are managed on the lantern's page).
function PhotoGrid({ photos, onRemove, large = false }) {
  return (
    <div className={`grid gap-2 ${large ? 'grid-cols-3' : 'grid-cols-4'}`}>
      {photos.map((p, i) => (
        <div key={p.preview} className={`relative ${large && i === 0 ? 'col-span-3' : ''}`}>
          <img
            src={p.preview}
            alt=""
            className={`w-full rounded-lg object-cover bg-gray-100 ${large && i === 0 ? 'max-h-64' : 'aspect-square'}`}
          />
          {i === 0 && <span className="absolute top-1 left-1 text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded">主要</span>}
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(i)}
              aria-label="移除這張照片 Remove photo"
              className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/60 text-white text-base leading-none flex items-center justify-center"
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
