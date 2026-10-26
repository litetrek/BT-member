import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { uploadInventoryPhoto } from '@/lib/inventoryPhoto'
import { VOLTAGE_OPTIONS, CONDITION_OPTIONS } from '@/lib/inventoryConstants'

export default function InventoryLanternForm({ lantern, onCancel }) {
  const router = useRouter()
  const isEdit = !!lantern

  const [form, setForm] = useState({
    name_zh: lantern?.name_zh ?? '',
    name_en: lantern?.name_en ?? '',
    category_id: lantern?.category_id ?? '',
    qty: lantern?.qty ?? 1,
    voltage: lantern?.voltage ?? '',
    power_w: lantern?.power_w ?? '',
    height_ft: lantern?.height_ft ?? '',
    width_ft: lantern?.width_ft ?? '',
    depth_ft: lantern?.depth_ft ?? '',
    location_id: lantern?.location_id ?? '',
    condition: lantern?.condition ?? 'Good',
    cloth_damage_pct: lantern?.cloth_damage_pct ?? 0,
    frame_damage_pct: lantern?.frame_damage_pct ?? 0,
    notes: lantern?.notes ?? '',
  })
  const [categories, setCategories] = useState([])
  const [locations, setLocations] = useState([])
  const [photoFiles, setPhotoFiles] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/inventory/categories').then((r) => r.json()).then((d) => setCategories(Array.isArray(d) ? d : []))
    fetch('/api/inventory/locations').then((r) => r.json()).then((d) => setLocations(Array.isArray(d) ? d : []))
  }, [])

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const body = {
      ...form,
      category_id: form.category_id || null,
      location_id: form.location_id || null,
      voltage: form.voltage || null,
      power_w: form.power_w === '' ? null : form.power_w,
      height_ft: form.height_ft === '' ? null : form.height_ft,
      width_ft: form.width_ft === '' ? null : form.width_ft,
      depth_ft: form.depth_ft === '' ? null : form.depth_ft,
      qty: Number(form.qty) || 1,
      cloth_damage_pct: Number(form.cloth_damage_pct),
      frame_damage_pct: Number(form.frame_damage_pct),
    }

    try {
      const url = isEdit ? `/api/inventory/lanterns/${lantern.tag_id}` : '/api/inventory/lanterns'
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.json()).error || '儲存失敗')
      const data = await res.json()

      let hasPrimary = isEdit && (lantern.photos?.some((p) => p.is_primary) ?? false)
      for (const file of photoFiles) {
        const { url, thumbUrl } = await uploadInventoryPhoto(file, 'lantern', data.id)
        await fetch('/api/inventory/photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            owner_type: 'lantern', owner_id: data.id,
            url, thumb_url: thumbUrl, is_primary: !hasPrimary,
          }),
        })
        hasPrimary = true
      }

      router.push(`/inventory/lanterns/${data.tag_id}`)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  const inputCls = 'w-full border border-gray-200 rounded px-3 py-2 text-base focus:outline-none focus:ring-1 focus:ring-blue-400'
  const labelCls = 'block text-sm text-gray-500 mb-1'

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-5 max-w-2xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>名稱（中文）Name (ZH)</label>
          <input required value={form.name_zh} onChange={(e) => update('name_zh', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>名稱（英文）Name (EN)</label>
          <input value={form.name_en} onChange={(e) => update('name_en', e.target.value)} className={inputCls} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <label className={labelCls}>類別 Category</label>
          <select value={form.category_id} onChange={(e) => update('category_id', e.target.value)} className={inputCls}>
            <option value="">—</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name_zh} {c.name_en}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>數量 QTY</label>
          <input type="number" min="1" value={form.qty} onChange={(e) => update('qty', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>電壓 Voltage</label>
          <select value={form.voltage} onChange={(e) => update('voltage', e.target.value)} className={inputCls}>
            <option value="">—</option>
            {VOLTAGE_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>功率 Power (W)</label>
          <input type="number" step="0.01" value={form.power_w} onChange={(e) => update('power_w', e.target.value)} className={inputCls} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={labelCls}>高 Height (ft)</label>
          <input type="number" step="0.01" value={form.height_ft} onChange={(e) => update('height_ft', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>寬 Width (ft)</label>
          <input type="number" step="0.01" value={form.width_ft} onChange={(e) => update('width_ft', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>深 Depth (ft)</label>
          <input type="number" step="0.01" value={form.depth_ft} onChange={(e) => update('depth_ft', e.target.value)} className={inputCls} />
        </div>
      </div>

      <div>
        <label className={labelCls}>地點 Location</label>
        <select value={form.location_id} onChange={(e) => update('location_id', e.target.value)} className={inputCls}>
          <option value="">—</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.code}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={labelCls}>狀況 Condition</label>
          <select value={form.condition} onChange={(e) => update('condition', e.target.value)} className={inputCls}>
            {CONDITION_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>布面損壞 Cloth damage (%)</label>
          <input type="number" min="0" max="100" step="5" value={form.cloth_damage_pct} onChange={(e) => update('cloth_damage_pct', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>骨架損壞 Frame damage (%)</label>
          <input type="number" min="0" max="100" step="5" value={form.frame_damage_pct} onChange={(e) => update('frame_damage_pct', e.target.value)} className={inputCls} />
        </div>
      </div>

      <div>
        <label className={labelCls}>備註 Notes</label>
        <textarea rows={3} value={form.notes} onChange={(e) => update('notes', e.target.value)} className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>照片 Photos {isEdit ? '（新增）' : ''}</label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setPhotoFiles(Array.from(e.target.files ?? []))}
          className="text-base"
        />
        {photoFiles.length > 0 && <p className="text-sm text-gray-400 mt-1">已選擇 {photoFiles.length} 張照片</p>}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-base text-gray-600 hover:text-gray-900">
          取消
        </button>
        <button type="submit" disabled={saving} className="px-4 py-2 text-base bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
          {saving ? '儲存中…' : '儲存'}
        </button>
      </div>
    </form>
  )
}
