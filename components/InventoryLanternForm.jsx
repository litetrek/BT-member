import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useSession } from 'next-auth/react'
import { getInventoryRole } from '@/lib/inventory'
import { uploadInventoryPhoto } from '@/lib/inventoryPhoto'
import { VOLTAGE_OPTIONS, CONDITION_OPTIONS, STATUS_OPTIONS, DISPLAY_DECISION_OPTIONS } from '@/lib/inventoryConstants'
import InventoryPhotoPicker from '@/components/InventoryPhotoPicker'
import InventoryLanternNameFields from '@/components/InventoryLanternNameFields'

const STATUS_LABELS = { Active: '使用中 Active', Retired: '退役 Retired', Missing: '遺失 Missing' }

export default function InventoryLanternForm({ lantern, onCancel }) {
  const router = useRouter()
  const { data: session } = useSession()
  const isAdmin = getInventoryRole(session) === 'admin'
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
    condition: lantern?.condition ?? '', // new lanterns: must be chosen before saving
    cloth_damage_pct: lantern?.cloth_damage_pct ?? 0,
    frame_damage_pct: lantern?.frame_damage_pct ?? 0,
    notes: lantern?.notes ?? '',
    status: lantern?.status ?? 'Active',
    display_decision: lantern?.display_decision ?? '',
  })
  const [categories, setCategories] = useState([])
  const [locations, setLocations] = useState([])
  const [photoFiles, setPhotoFiles] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // Inline category editor (admin only): null | { mode: 'new' | 'edit', id?, name_zh, name_en }
  const [catEdit, setCatEdit] = useState(null)
  const [catSaving, setCatSaving] = useState(false)
  const [catError, setCatError] = useState('')

  useEffect(() => {
    fetch('/api/inventory/categories').then((r) => r.json()).then((d) => setCategories(Array.isArray(d) ? d : []))
    fetch('/api/inventory/locations').then((r) => r.json()).then((d) => setLocations(Array.isArray(d) ? d : []))
  }, [])

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function startCategoryEdit(mode) {
    setCatError('')
    if (mode === 'edit') {
      const c = categories.find((x) => String(x.id) === String(form.category_id))
      if (!c) return
      setCatEdit({ mode, id: c.id, name_zh: c.name_zh, name_en: c.name_en })
    } else {
      setCatEdit({ mode, name_zh: '', name_en: '' })
    }
  }

  async function saveCategory() {
    const name_zh = catEdit.name_zh.trim()
    const name_en = catEdit.name_en.trim()
    if (!name_zh || !name_en) { setCatError('請填寫中文與英文名稱'); return }
    setCatSaving(true)
    setCatError('')
    try {
      const isNew = catEdit.mode === 'new'
      const res = await fetch(isNew ? '/api/inventory/categories' : `/api/inventory/categories/${catEdit.id}`, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name_zh, name_en }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || '儲存失敗')
      const saved = await res.json()
      setCategories((list) => isNew ? [...list, saved] : list.map((c) => (c.id === saved.id ? saved : c)))
      if (isNew) update('category_id', saved.id)
      setCatEdit(null)
    } catch (err) {
      setCatError(err.message)
    } finally {
      setCatSaving(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const body = {
      ...form,
      name_zh: form.name_zh.trim(),
      name_en: form.name_en.trim() || null,
      category_id: form.category_id || null,
      location_id: form.location_id || null,
      voltage: form.voltage || null,
      display_decision: form.display_decision || null,
      power_w: form.power_w === '' ? null : form.power_w,
      height_ft: form.height_ft === '' ? null : form.height_ft,
      width_ft: form.width_ft === '' ? null : form.width_ft,
      depth_ft: form.depth_ft === '' ? null : form.depth_ft,
      qty: Number(form.qty) || 1,
      cloth_damage_pct: Number(form.cloth_damage_pct),
      frame_damage_pct: Number(form.frame_damage_pct),
    }

    if (!isEdit) { delete body.status; delete body.display_decision }

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
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 space-y-5 max-w-2xl">
      <InventoryLanternNameFields
        nameZh={form.name_zh}
        nameEn={form.name_en}
        onChange={update}
        inputCls={inputCls}
        labelCls={labelCls}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <label className={labelCls}>類別 Category</label>
          <select value={form.category_id} onChange={(e) => update('category_id', e.target.value)} className={inputCls}>
            <option value="">—</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name_zh} {c.name_en}</option>)}
          </select>
          {isAdmin && !catEdit && (
            <div className="flex gap-3 mt-1">
              <button type="button" onClick={() => startCategoryEdit('new')} className="text-sm text-blue-600 hover:underline">+ 新增類別</button>
              {form.category_id && (
                <button type="button" onClick={() => startCategoryEdit('edit')} className="text-sm text-blue-600 hover:underline">編輯</button>
              )}
            </div>
          )}
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

      {catEdit && (
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">
            {catEdit.mode === 'new' ? '新增類別 New category' : '編輯類別 Edit category'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              placeholder="中文名稱"
              value={catEdit.name_zh}
              onChange={(e) => setCatEdit((c) => ({ ...c, name_zh: e.target.value }))}
              className={inputCls + ' bg-white'}
            />
            <input
              placeholder="English name"
              value={catEdit.name_en}
              onChange={(e) => setCatEdit((c) => ({ ...c, name_en: e.target.value }))}
              className={inputCls + ' bg-white'}
            />
          </div>
          {catError && <p className="text-sm text-red-500">{catError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCatEdit(null)} className="px-3 py-2 text-base text-gray-600 hover:text-gray-900">取消</button>
            <button type="button" onClick={saveCategory} disabled={catSaving} className="px-3 py-2 text-base bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
              {catSaving ? '儲存中…' : '儲存類別'}
            </button>
          </div>
        </div>
      )}

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
          <option value="">— 未指定地點 Unassigned —</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.code}</option>)}
        </select>
      </div>

      {isEdit && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>狀態 Status</label>
            <select value={form.status} onChange={(e) => update('status', e.target.value)} className={inputCls}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>展示決定 Display decision</label>
            <select value={form.display_decision} onChange={(e) => update('display_decision', e.target.value)} className={inputCls}>
              <option value="">— 未決定 Undecided —</option>
              {DISPLAY_DECISION_OPTIONS.map((d) => (
                <option key={d} value={d} disabled={d === 'Selected' && !lantern.displayable && lantern.display_decision !== 'Selected'}>
                  {d}{d === 'Selected' && !lantern.displayable ? '（不可展示）' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={labelCls}>狀況 Condition</label>
          <select required value={form.condition} onChange={(e) => update('condition', e.target.value)} className={inputCls}>
            <option value="" disabled>— 請選擇 —</option>
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
        <InventoryPhotoPicker
          multiple
          onFiles={(files) => setPhotoFiles((prev) => [...prev, ...files])}
        />
        {photoFiles.length > 0 && (
          <p className="text-sm text-gray-400 mt-1">
            已選擇 {photoFiles.length} 張照片
            <button type="button" onClick={() => setPhotoFiles([])} className="ml-3 text-blue-600 hover:underline">清除</button>
          </p>
        )}
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
