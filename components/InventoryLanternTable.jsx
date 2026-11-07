// 表格 Table view of the (filtered, sorted) lantern list. Everyone sees the table; admins
// can edit cells in place. Edits stay in the browser — changed cells turn yellow — until
// the admin presses 儲存修改, reviews the list of changes and confirms. The save goes to
// /api/inventory/lanterns/batch, which checks every row first and saves nothing if any
// row is invalid or was changed by someone else in the meantime.
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import {
  buildTableColumns, cellText, cellsEqual, toPayloadValue, optionLabel,
} from '@/lib/inventoryLanternTable'
import InventoryDisplayableBadge from '@/components/InventoryDisplayableBadge'
import Spinner from '@/components/Spinner'

export default function InventoryLanternTable({ lanterns, loading, categories, locations, canEdit, onSaved }) {
  const columns = useMemo(() => buildTableColumns({ categories, locations }), [categories, locations])

  // { [tag_id]: { base: <row as loaded>, values: { field: inputValue } } }
  const [edits, setEdits] = useState({})
  const [rowErrors, setRowErrors] = useState({}) // { [tag_id]: message }
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null) // { type: 'ok' | 'error', text }
  const [bulkField, setBulkField] = useState('')
  const [bulkValue, setBulkValue] = useState('')

  const changeList = useMemo(() => {
    const list = []
    for (const [tag_id, e] of Object.entries(edits)) {
      const fields = Object.entries(e.values).filter(([f, v]) => !cellsEqual(f, e.base[f], v))
      if (fields.length) list.push({ tag_id, base: e.base, fields })
    }
    return list
  }, [edits])
  const changedCellCount = changeList.reduce((n, c) => n + c.fields.length, 0)
  const dirty = changedCellCount > 0

  // Warn before leaving with unsaved edits: closing / reloading the tab, or moving to
  // another page inside the app (nav tabs, back link). Aborting a Next.js route change
  // requires throwing from routeChangeStart.
  const router = useRouter()
  useEffect(() => {
    if (!dirty) return
    const warn = (ev) => { ev.preventDefault(); ev.returnValue = '' }
    const onRoute = (url) => {
      if (url === router.asPath) return
      if (window.confirm('表格有未儲存的修改，確定要離開嗎？ Leave without saving?')) return
      router.events.emit('routeChangeError')
      throw 'Route change aborted: unsaved lantern table edits' // eslint-disable-line no-throw-literal
    }
    window.addEventListener('beforeunload', warn)
    router.events.on('routeChangeStart', onRoute)
    return () => {
      window.removeEventListener('beforeunload', warn)
      router.events.off('routeChangeStart', onRoute)
    }
  }, [dirty, router])

  function setCell(lantern, field, value) {
    setMessage(null)
    setEdits((prev) => {
      const cur = prev[lantern.tag_id] ?? { base: lantern, values: {} }
      return { ...prev, [lantern.tag_id]: { ...cur, values: { ...cur.values, [field]: value } } }
    })
  }

  function valueOf(lantern, field) {
    const e = edits[lantern.tag_id]
    if (e && Object.prototype.hasOwnProperty.call(e.values, field)) return e.values[field]
    return cellText(field, lantern[field])
  }

  function isChanged(lantern, field) {
    const e = edits[lantern.tag_id]
    if (!e || !Object.prototype.hasOwnProperty.call(e.values, field)) return false
    return !cellsEqual(field, e.base[field], e.values[field])
  }

  function discardAll() {
    if (!window.confirm(`放棄 ${changedCellCount} 項未儲存的修改？ Discard all unsaved changes?`)) return
    setEdits({}); setRowErrors({}); setMessage(null)
  }

  function applyBulk() {
    const col = columns.find((c) => c.key === bulkField)
    if (!col) return
    for (const l of lanterns) setCell(l, col.key, col.type === 'checkbox' ? bulkValue === 'true' : bulkValue)
    setMessage({ type: 'ok', text: `已將 ${lanterns.length} 筆的「${col.label}」設為新值，按「儲存修改」才會存檔。` })
  }

  async function save() {
    setSaving(true)
    setRowErrors({})
    const updates = changeList.map((c) => ({
      tag_id: c.tag_id,
      updated_at: c.base.updated_at,
      changes: Object.fromEntries(c.fields.map(([f, v]) => [f, toPayloadValue(f, v)])),
    }))
    try {
      const res = await fetch('/api/inventory/lanterns/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })
      const data = await res.json().catch(() => ({}))
      const errs = Object.fromEntries((data.errors ?? []).map((e) => [e.tag_id, e.error]))
      if (res.status === 400 && data.errors) {
        setRowErrors(errs)
        setMessage({ type: 'error', text: `沒有儲存任何資料：${data.errors.length} 筆有問題（紅色列），請修正後再儲存。` })
      } else if (!res.ok && res.status !== 207) {
        setMessage({ type: 'error', text: data.error ?? `儲存失敗 Save failed (${res.status})` })
      } else {
        const savedTags = new Set((data.saved ?? []).map((r) => r.tag_id))
        setEdits((prev) => Object.fromEntries(Object.entries(prev).filter(([t]) => !savedTags.has(t))))
        setRowErrors(errs)
        setMessage(Object.keys(errs).length
          ? { type: 'error', text: `已儲存 ${savedTags.size} 筆，${Object.keys(errs).length} 筆失敗（紅色列）。` }
          : { type: 'ok', text: `已儲存 ${savedTags.size} 筆燈籠。 Saved.` })
        onSaved?.()
      }
    } catch {
      setMessage({ type: 'error', text: '網路錯誤，沒有儲存。 Network error — nothing saved.' })
    }
    setSaving(false)
    setConfirming(false)
  }

  // Enter moves to the same column on the next row (like a spreadsheet).
  function onKeyDown(ev, rowIdx, colIdx) {
    if (ev.key !== 'Enter' || ev.shiftKey || ev.nativeEvent.isComposing) return
    const nextEl = document.querySelector(`[data-cell="${rowIdx + 1}-${colIdx}"]`)
    if (nextEl) { ev.preventDefault(); nextEl.focus(); nextEl.select?.() }
  }

  // Edited lanterns that the current filters hide are still saved — say so.
  const shownTags = new Set(lanterns.map((l) => l.tag_id))
  const hiddenChanged = changeList.filter((c) => !shownTags.has(c.tag_id)).length

  const inputBase = 'w-full bg-transparent px-1.5 py-1 text-sm rounded focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white'

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="bg-white rounded-lg border border-gray-200 p-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-gray-600">批次設定 Set for all {lanterns.length} shown：</span>
          <select value={bulkField} onChange={(e) => {
            const col = columns.find((c) => c.key === e.target.value)
            setBulkField(e.target.value)
            setBulkValue(col?.type === 'select' ? col.options[0].value : '')
          }} className="border border-gray-200 rounded px-2 py-1.5">
            <option value="">選擇欄位…</option>
            {columns.filter((c) => c.bulk).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          {bulkField && (() => {
            const col = columns.find((c) => c.key === bulkField)
            if (col.type === 'select') return (
              <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="border border-gray-200 rounded px-2 py-1.5">
                {col.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )
            if (col.type === 'checkbox') return (
              <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="border border-gray-200 rounded px-2 py-1.5">
                <option value="">選擇…</option>
                <option value="true">是 Yes</option>
                <option value="false">否 No</option>
              </select>
            )
            return <input type={col.type === 'number' ? 'number' : 'text'} value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="border border-gray-200 rounded px-2 py-1.5 w-32" />
          })()}
          <button
            onClick={applyBulk}
            disabled={!bulkField || lanterns.length === 0 || (columns.find((c) => c.key === bulkField)?.type === 'checkbox' && bulkValue === '')}
            className="px-3 py-1.5 rounded border border-blue-300 text-blue-700 hover:bg-blue-50 disabled:opacity-40"
          >
            套用 Apply
          </button>
          <span className="text-xs text-gray-400">套用後仍需按「儲存修改」</span>
        </div>
      )}

      {canEdit && (dirty || message) && (
        <div className={`sticky top-0 z-20 rounded-lg border p-3 flex flex-wrap items-center gap-3 text-sm ${dirty ? 'bg-yellow-50 border-yellow-300' : message?.type === 'error' ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
          {dirty && (
            <span className="font-medium text-gray-800">
              {changeList.length} 筆燈籠、{changedCellCount} 項修改尚未儲存
              {hiddenChanged > 0 && <span className="text-gray-500 font-normal">（其中 {hiddenChanged} 筆不在目前篩選中）</span>}
            </span>
          )}
          {message && <span className={message.type === 'error' ? 'text-red-700' : 'text-green-700'}>{message.text}</span>}
          {dirty && (
            <div className="ml-auto flex gap-2">
              <button onClick={discardAll} className="px-3 py-1.5 rounded text-gray-600 hover:text-gray-900">放棄修改</button>
              <button onClick={() => setConfirming(true)} className="px-4 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700">
                儲存修改 Save…
              </button>
            </div>
          )}
        </div>
      )}

      <div className={`overflow-auto max-h-[75vh] bg-white rounded-lg border border-gray-200 transition-opacity ${loading ? 'opacity-50 pointer-events-none' : ''}`} aria-busy={loading}>
        <table className="text-sm border-collapse min-w-max">
          <thead className="sticky top-0 z-10 bg-gray-100 text-gray-600">
            <tr>
              {columns.map((c, i) => (
                <th key={c.key} className={`px-2 py-2 text-left font-medium whitespace-nowrap border-b border-gray-200 ${i === 0 ? 'sticky left-0 z-10 bg-gray-100' : ''}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lanterns.map((l, rowIdx) => {
              const err = rowErrors[l.tag_id]
              return (
                <tr key={l.id} className={`border-b border-gray-100 ${err ? 'bg-red-50' : 'hover:bg-blue-50/40'}`}>
                  {columns.map((c, colIdx) => {
                    const changed = isChanged(l, c.key)
                    const cellCls = `px-1 py-0.5 align-top ${c.width ?? ''} ${changed ? 'bg-yellow-100' : ''} ${colIdx === 0 ? `sticky left-0 z-[5] ${err ? 'bg-red-50' : changed ? 'bg-yellow-100' : 'bg-white'}` : ''}`
                    if (c.key === 'tag_id') {
                      return (
                        <td key={c.key} className={`${cellCls} px-2 py-1.5 whitespace-nowrap`}>
                          {/* New tab, so unsaved table edits are not lost. */}
                          <Link href={`/inventory/lanterns/${l.tag_id}`} target="_blank" className="font-mono text-blue-700 hover:underline">{l.tag_id}</Link>
                          {!l.displayable && <span className="ml-1"><InventoryDisplayableBadge reasons={l.displayable_reasons} /></span>}
                          {err && <p className="text-xs text-red-700 whitespace-normal max-w-[14rem] mt-0.5">{err}</p>}
                        </td>
                      )
                    }
                    if (!canEdit) {
                      return <td key={c.key} className={`${cellCls} px-2 py-1.5 whitespace-nowrap`}>{optionLabel(c, cellText(c.key, l[c.key])) || <span className="text-gray-300">—</span>}</td>
                    }
                    const v = valueOf(l, c.key)
                    const common = {
                      'data-cell': `${rowIdx}-${colIdx}`,
                      'aria-label': `${l.tag_id} ${c.label}`,
                      onKeyDown: (ev) => onKeyDown(ev, rowIdx, colIdx),
                    }
                    return (
                      <td key={c.key} className={cellCls}>
                        {c.type === 'select' ? (
                          <select {...common} value={v} onChange={(e) => setCell(l, c.key, e.target.value)} className={inputBase}>
                            {/* Keep an unknown legacy value visible instead of silently changing it. */}
                            {!c.options.some((o) => o.value === v) && <option value={v}>{v}</option>}
                            {c.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        ) : c.type === 'checkbox' ? (
                          <div className="flex justify-center py-1">
                            <input {...common} type="checkbox" checked={v === true || v === 'true'} onChange={(e) => setCell(l, c.key, e.target.checked)} className="w-4 h-4" />
                          </div>
                        ) : (
                          <input
                            {...common}
                            type={c.type === 'number' ? 'number' : 'text'}
                            min={c.min} max={c.max} step={c.step}
                            value={v}
                            onChange={(e) => setCell(l, c.key, e.target.value)}
                            className={inputBase}
                          />
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
            {lanterns.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-gray-400">
                  {loading ? '載入中… Loading' : '沒有符合篩選的燈籠。 No lanterns match the filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {confirming && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-lg flex flex-col max-h-[85vh]">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 text-base">確認儲存 Confirm save</h2>
              <p className="text-sm text-gray-600 mt-1">將修改 {changeList.length} 筆燈籠、共 {changedCellCount} 項：</p>
            </div>
            <ul className="overflow-auto p-5 space-y-3 text-sm">
              {changeList.map((c) => (
                <li key={c.tag_id}>
                  <p className="font-medium text-gray-900">
                    <span className="font-mono text-gray-500">{c.tag_id}</span> {c.base.name_zh}
                    {!shownTags.has(c.tag_id) && <span className="ml-1 text-xs text-amber-700">（不在目前篩選中）</span>}
                  </p>
                  <ul className="mt-1 space-y-0.5 text-gray-700">
                    {c.fields.map(([f, v]) => {
                      const col = columns.find((x) => x.key === f)
                      const before = optionLabel(col, cellText(f, c.base[f])) || '—'
                      const after = optionLabel(col, v) || '—'
                      return (
                        <li key={f} className="pl-3">
                          {col?.label ?? f}：<span className="text-gray-400 line-through">{before}</span> → <span className="text-blue-700 font-medium">{after}</span>
                        </li>
                      )
                    })}
                  </ul>
                </li>
              ))}
            </ul>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setConfirming(false)} disabled={saving} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                返回修改 Back
              </button>
              <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2">
                {saving && <Spinner size="sm" />} 確認儲存 Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
