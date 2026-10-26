import { useState } from 'react'
import { uploadInventoryPhoto } from '@/lib/inventoryPhoto'

const ZONES = ['A', 'B', 'C', 'D', 'E', 'Cabin']

export default function InventoryLocationForm({ location, onClose, onSaved }) {
  const isEdit = !!location
  const [form, setForm] = useState({
    code: location?.code ?? '',
    zone: location?.zone ?? 'A',
    description: location?.description ?? '',
  })
  const [photoFile, setPhotoFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      let locationId = location?.id
      let code = location?.code

      if (!isEdit) {
        const res = await fetch('/api/inventory/locations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error((await res.json()).error || '儲存失敗')
        const data = await res.json()
        locationId = data.id
        code = data.code
      }

      let photo_url, photo_thumb_url
      if (photoFile) {
        const up = await uploadInventoryPhoto(photoFile, 'location', locationId)
        photo_url = up.url
        photo_thumb_url = up.thumbUrl
      }

      const putRes = await fetch(`/api/inventory/locations/${code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone: form.zone, description: form.description, photo_url, photo_thumb_url }),
      })
      if (!putRes.ok) throw new Error((await putRes.json()).error || '儲存失敗')

      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full border border-gray-200 rounded px-3 py-2 text-base focus:outline-none focus:ring-1 focus:ring-blue-400'

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-lg">
        <h2 className="font-semibold text-gray-900 mb-1">
          {isEdit ? '編輯地點' : '新增地點'}
        </h2>
        <p className="text-sm text-gray-400 mb-4">{isEdit ? 'Edit location' : 'New location'}</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm text-gray-500 mb-1">代碼 Code</label>
            <input
              type="text"
              required
              disabled={isEdit}
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className={`${inputCls} ${isEdit ? 'bg-gray-50 text-gray-400' : ''}`}
              placeholder="e.g. F1"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-500 mb-1">分區 Zone</label>
            <select
              value={form.zone}
              onChange={(e) => setForm({ ...form, zone: e.target.value })}
              className={inputCls}
            >
              {ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-500 mb-1">說明 Description</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={inputCls}
              placeholder="在哪裡、如何進入"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-500 mb-1">照片 Photo</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
              className="text-base"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-base text-gray-600 hover:text-gray-900">
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-base bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '儲存中…' : '儲存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
