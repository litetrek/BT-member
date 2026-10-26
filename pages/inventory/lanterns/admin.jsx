import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { getInventoryRole } from '@/lib/inventory'
import InventoryLanternNav from '@/components/InventoryLanternNav'
import InventoryHeader from '@/components/InventoryHeader'
import Spinner from '@/components/Spinner'

export default function LanternAdmin() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const role = getInventoryRole(session)

  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [edits, setEdits] = useState({}) // id -> { name_zh, name_en }
  const [savingId, setSavingId] = useState('')
  const [newCat, setNewCat] = useState({ name_zh: '', name_en: '' })
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/inventory')
    if (status === 'authenticated' && role !== 'admin') router.replace('/inventory/lanterns')
  }, [status, role])

  function load() {
    setLoading(true)
    fetch('/api/inventory/categories')
      .then((r) => r.json())
      .then((d) => { setCategories(Array.isArray(d) ? d : []); setEdits({}); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    if (status === 'authenticated' && role === 'admin') load()
  }, [status, role])

  function editField(cat, field, value) {
    setEdits((prev) => ({
      ...prev,
      [cat.id]: {
        name_zh: field === 'name_zh' ? value : (prev[cat.id]?.name_zh ?? cat.name_zh),
        name_en: field === 'name_en' ? value : (prev[cat.id]?.name_en ?? cat.name_en),
      },
    }))
  }

  function isDirty(cat) {
    const e = edits[cat.id]
    return e && (e.name_zh !== cat.name_zh || e.name_en !== cat.name_en)
  }

  async function handleSave(cat) {
    const e = edits[cat.id]
    if (!e || !e.name_zh || !e.name_en) return
    setSavingId(cat.id)
    setError('')
    try {
      const res = await fetch(`/api/inventory/categories/${cat.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(e),
      })
      if (!res.ok) throw new Error((await res.json()).error || '儲存失敗')
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingId('')
    }
  }

  async function handleAdd() {
    if (!newCat.name_zh || !newCat.name_en) return
    setAdding(true)
    setError('')
    try {
      const res = await fetch('/api/inventory/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCat),
      })
      if (!res.ok) throw new Error((await res.json()).error || '新增失敗')
      setNewCat({ name_zh: '', name_en: '' })
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  if (status !== 'authenticated' || role !== 'admin') return null

  const inputCls = 'w-full border border-gray-200 rounded px-2 py-1.5 text-base focus:outline-none focus:ring-1 focus:ring-blue-400'

  return (
    <>
      <Head><title>管理 · 燈籠庫存</title></Head>
      <div className="min-h-screen bg-gray-50">
        <InventoryHeader icon="settings" backHref="/inventory/lanterns" backLabel="燈籠列表" title="管理" subtitle="Admin" />
        <InventoryLanternNav active="admin" />

        <main className="max-w-6xl mx-auto px-6 py-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">類別 Categories</h2>
          <p className="text-sm text-gray-400 mb-4">管理燈籠類別（中文／英文名稱）</p>
          {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

          {loading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="grid grid-cols-[1fr_1fr_auto] gap-3 px-4 py-2 bg-gray-50 border-b border-gray-200 text-sm text-gray-500">
                <span>中文名稱</span>
                <span>English Name</span>
                <span></span>
              </div>
              <div className="divide-y divide-gray-100">
                {categories.map((cat) => {
                  const e = edits[cat.id]
                  const dirty = isDirty(cat)
                  return (
                    <div key={cat.id} className="grid grid-cols-[1fr_1fr_auto] gap-3 px-4 py-2 items-center">
                      <input
                        value={e?.name_zh ?? cat.name_zh}
                        onChange={(ev) => editField(cat, 'name_zh', ev.target.value)}
                        className={inputCls}
                      />
                      <input
                        value={e?.name_en ?? cat.name_en}
                        onChange={(ev) => editField(cat, 'name_en', ev.target.value)}
                        className={inputCls}
                      />
                      <button
                        onClick={() => handleSave(cat)}
                        disabled={!dirty || savingId === cat.id}
                        className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        {savingId === cat.id ? '儲存中…' : '儲存'}
                      </button>
                    </div>
                  )
                })}

                <div className="grid grid-cols-[1fr_1fr_auto] gap-3 px-4 py-3 items-center bg-blue-50/40">
                  <input
                    placeholder="中文名稱"
                    value={newCat.name_zh}
                    onChange={(e) => setNewCat((c) => ({ ...c, name_zh: e.target.value }))}
                    className={inputCls}
                  />
                  <input
                    placeholder="English Name"
                    value={newCat.name_en}
                    onChange={(e) => setNewCat((c) => ({ ...c, name_en: e.target.value }))}
                    className={inputCls}
                  />
                  <button
                    onClick={handleAdd}
                    disabled={!newCat.name_zh || !newCat.name_en || adding}
                    className="text-sm bg-gray-800 text-white px-3 py-1.5 rounded hover:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {adding ? '新增中…' : '+ 新增類別'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  )
}
