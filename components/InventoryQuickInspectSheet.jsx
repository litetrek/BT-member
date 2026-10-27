import { useEffect, useState } from 'react'
import { uploadInventoryPhoto } from '@/lib/inventoryPhoto'
import { saveDraft, loadDraft, clearDraft, markChecked } from '@/lib/inventoryFieldDraft'
import { CONDITION_OPTIONS } from '@/lib/inventoryConstants'
import InventoryPhotoPicker from '@/components/InventoryPhotoPicker'

// Used both from Field mode (fixedLocationId + locationCode set, no location picker shown —
// the lantern is simply recorded as being wherever the recorder is standing) and from the
// lantern detail page's "記錄檢查" button (no fixedLocationId — shows a location select,
// defaulting to the lantern's current location).
export default function InventoryQuickInspectSheet({ lantern, fixedLocationId, locationCode, locations, onClose, onSaved }) {
  const draftKey = `inspect:${lantern.id}`
  const draft = loadDraft(draftKey)

  const [form, setForm] = useState({
    condition: draft?.condition ?? lantern.condition ?? 'Good',
    cloth_damage_pct: draft?.cloth_damage_pct ?? lantern.cloth_damage_pct ?? 0,
    frame_damage_pct: draft?.frame_damage_pct ?? lantern.frame_damage_pct ?? 0,
    notes: draft?.notes ?? '',
    location_id: draft?.location_id ?? fixedLocationId ?? lantern.location_id ?? '',
  })
  const [photoFiles, setPhotoFiles] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    saveDraft(draftKey, form)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form])

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/inventory/inspections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lantern_id: lantern.id,
          location_id: fixedLocationId || form.location_id || null,
          condition: form.condition,
          cloth_damage_pct: Number(form.cloth_damage_pct),
          frame_damage_pct: Number(form.frame_damage_pct),
          notes: form.notes || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error || '儲存失敗')
      const data = await res.json()

      let hasPrimary = true // don't disturb an existing primary photo from quick inspect
      for (const file of photoFiles) {
        const { url, thumbUrl } = await uploadInventoryPhoto(file, 'lantern', lantern.id)
        await fetch('/api/inventory/photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ owner_type: 'lantern', owner_id: lantern.id, url, thumb_url: thumbUrl, is_primary: false }),
        })
      }

      clearDraft(draftKey)
      if (locationCode) markChecked(locationCode, lantern.id)
      onSaved(data.lantern)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  const sliderRow = (label, field) => (
    <div>
      <div className="flex justify-between text-sm text-gray-500 mb-1">
        <span>{label}</span>
        <span className="font-medium text-gray-700">{form[field]}%</span>
      </div>
      <input
        type="range" min="0" max="100" step="5"
        value={form[field]}
        onChange={(e) => update(field, e.target.value)}
        className="w-full"
      />
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-end sm:items-center sm:justify-center">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto p-6 space-y-5">
        <div>
          <h2 className="font-semibold text-gray-900 text-lg">快速檢查 Quick Inspect</h2>
          <p className="text-sm text-gray-400 font-mono">{lantern.tag_id} — {lantern.name_zh}</p>
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

        {sliderRow('布面損壞 Cloth damage', 'cloth_damage_pct')}
        {sliderRow('骨架損壞 Frame damage', 'frame_damage_pct')}

        {!fixedLocationId && (
          <div>
            <label className="block text-sm text-gray-500 mb-1">地點 Location</label>
            <select
              value={form.location_id}
              onChange={(e) => update('location_id', e.target.value)}
              className="w-full border border-gray-200 rounded px-3 py-2 text-base focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="">—</option>
              {locations?.map((l) => <option key={l.id} value={l.id}>{l.code}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm text-gray-500 mb-1">備註 Notes</label>
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            className="w-full border border-gray-200 rounded px-3 py-2 text-base focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-500 mb-1">照片 Photos</label>
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

        <div className="sticky bottom-0 bg-white pt-2 flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 text-base text-gray-600 border border-gray-200 rounded-lg">
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '儲存中…' : '儲存並下一個'}
          </button>
        </div>
      </div>
    </div>
  )
}
