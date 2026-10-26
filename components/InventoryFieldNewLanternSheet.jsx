import { useEffect, useState } from 'react'
import { uploadInventoryPhoto } from '@/lib/inventoryPhoto'
import { saveDraft, loadDraft, clearDraft, markChecked } from '@/lib/inventoryFieldDraft'
import { CONDITION_OPTIONS, VOLTAGE_OPTIONS } from '@/lib/inventoryConstants'

// Field mode's "+ New lantern" flow: photo first (per spec), then fields, then the
// auto-assigned tag ID shown large so it can go straight on a temporary label.
export default function InventoryFieldNewLanternSheet({ fixedLocationId, locationCode, categories, onClose, onSaved }) {
  const draftKey = `newlantern:${locationCode}`
  const draft = loadDraft(draftKey)

  const [step, setStep] = useState('photo') // photo | details | done
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
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
    condition: draft?.condition ?? 'Good',
    cloth_damage_pct: draft?.cloth_damage_pct ?? 0,
    frame_damage_pct: draft?.frame_damage_pct ?? 0,
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

  function handlePhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSubmit() {
    setSaving(true)
    setError('')
    try {
      const body = {
        ...form,
        category_id: form.category_id || null,
        voltage: form.voltage || null,
        power_w: form.power_w === '' ? null : form.power_w,
        height_ft: form.height_ft === '' ? null : form.height_ft,
        width_ft: form.width_ft === '' ? null : form.width_ft,
        depth_ft: form.depth_ft === '' ? null : form.depth_ft,
        qty: Number(form.qty) || 1,
        cloth_damage_pct: Number(form.cloth_damage_pct),
        frame_damage_pct: Number(form.frame_damage_pct),
        location_id: fixedLocationId,
      }
      const res = await fetch('/api/inventory/lanterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.json()).error || '儲存失敗')
      const lantern = await res.json()

      if (photoFile) {
        const { url, thumbUrl } = await uploadInventoryPhoto(photoFile, 'lantern', lantern.id)
        await fetch('/api/inventory/photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ owner_type: 'lantern', owner_id: lantern.id, url, thumb_url: thumbUrl, is_primary: true }),
        })
      }

      clearDraft(draftKey)
      markChecked(locationCode, lantern.id)
      setCreatedTag(lantern.tag_id)
      setStep('done')
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
            <p className="text-sm text-gray-500">先拍照 Take a photo first</p>
            {photoPreview ? (
              <img src={photoPreview} alt="" className="w-full rounded-lg object-cover max-h-64" />
            ) : (
              <div className="w-full h-48 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300 text-sm">
                尚未拍照
              </div>
            )}
            <input type="file" accept="image/*" onChange={handlePhotoChange} className="text-base" />
            <div className="sticky bottom-0 bg-white pt-2 flex gap-2">
              <button onClick={onClose} className="flex-1 py-3 text-base text-gray-600 border border-gray-200 rounded-lg">取消</button>
              <button
                onClick={() => setStep('details')}
                disabled={!photoFile}
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
            <div>
              <label className="block text-sm text-gray-500 mb-1">名稱 Name</label>
              <input required value={form.name_zh} onChange={(e) => update('name_zh', e.target.value)} className={inputCls} />
            </div>
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

            <div>
              <p className="text-sm text-gray-500 mb-2">狀況 Condition</p>
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

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="sticky bottom-0 bg-white pt-2 flex gap-2">
              <button onClick={() => setStep('photo')} className="flex-1 py-3 text-base text-gray-600 border border-gray-200 rounded-lg">返回</button>
              <button
                onClick={handleSubmit}
                disabled={saving || !form.name_zh}
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
            <button onClick={handleDone} className="w-full py-3 text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              完成 Done
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
