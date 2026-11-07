// 表格 Table view of the (filtered, sorted) lantern list. Everyone sees the table; admins
// can edit cells in place. Edits stay in the browser — changed cells turn yellow — until
// the admin presses 儲存修改, reviews the list of changes and confirms. The save goes to
// /api/inventory/lanterns/batch, which checks every row first and saves nothing if any
// row is invalid or was changed by someone else in the meantime.
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import {
  buildTableColumns, cellText, cellsEqual, toPayloadValue, optionLabel,
} from '@/lib/inventoryLanternTable'
import InventoryDisplayableBadge from '@/components/InventoryDisplayableBadge'
import Spinner from '@/components/Spinner'

const KEEP = '__keep__' // 批次 row: leave this column unchanged

// Frozen columns stay put while the table scrolls sideways, so each row's tag and
// Chinese name are always visible next to the cells being edited. Fixed widths so the
// second column knows where the first one ends.
const FROZEN = {
  tag_id: { cls: 'sticky left-0 w-[10.5rem] min-w-[10.5rem] max-w-[10.5rem]' },
  name_zh: { cls: 'sticky left-[10.5rem] w-[11rem] min-w-[11rem] max-w-[11rem] overflow-hidden text-ellipsis shadow-[2px_0_0_0_#d1d5db]' },
}

export default function InventoryLanternTable({ lanterns, loading, categories, locations, canEdit, onSaved }) {
  const columns = useMemo(() => buildTableColumns({ categories, locations }), [categories, locations])

  // { [tag_id]: { base: <row as loaded>, values: { field: inputValue } } }
  const [edits, setEdits] = useState({})
  const [rowErrors, setRowErrors] = useState({}) // { [tag_id]: message }
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null) // { type: 'ok' | 'error', text }
  // Batch update: tick rows, then fill a cell in the blue 批次 row at the top. Those
  // values apply to every ticked row (shown in blue) and are saved with the other edits.
  const [selected, setSelected] = useState(() => new Set()) // tag_ids
  const [batchValues, setBatchValues] = useState({}) // { field: value } — only fields being set

  // Hover preview: pointing at a lantern's 編號 or 中文名稱 shows its photo next to the
  // mouse. Position is written straight to the element so moving the mouse doesn't
  // re-render the whole table.
  const [preview, setPreview] = useState(null) // the lantern being pointed at
  const previewRef = useRef(null)
  function placePreview(ev) {
    const el = previewRef.current
    if (!el) return
    const w = el.offsetWidth || 200, h = el.offsetHeight || 270, gap = 16
    // Below-right of the pointer; flip left / above when it would leave the window.
    const x = ev.clientX + gap + w > window.innerWidth ? ev.clientX - gap - w : ev.clientX + gap
    const y = ev.clientY + gap + h > window.innerHeight ? ev.clientY - gap - h : ev.clientY + gap
    el.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, y)}px)`
  }
  const lastPointer = useRef(null)
  useEffect(() => { if (preview && lastPointer.current) placePreview(lastPointer.current) }, [preview])
  function previewHandlers(lantern) {
    return {
      onMouseEnter: (ev) => { lastPointer.current = { clientX: ev.clientX, clientY: ev.clientY }; setPreview(lantern) },
      onMouseMove: (ev) => { lastPointer.current = { clientX: ev.clientX, clientY: ev.clientY }; placePreview(ev) },
      onMouseLeave: () => setPreview(null),
    }
  }

  // Columns the database doesn't have yet (scripts/migrate-lantern-fields.js not run):
  // the list API simply leaves them out of each row. Show them as unavailable rather than
  // let edits be made that the server can't store.
  const unavailable = useMemo(() => {
    if (!lanterns.length) return new Set()
    return new Set(['repair_ease', 'base_type', 'size_class'].filter((f) => !(f in lanterns[0])))
  }, [lanterns])
  const UNAVAILABLE_TITLE = '資料庫尚未更新，這一欄還不能儲存：請管理員執行 node scripts/migrate-lantern-fields.js'

  const byTag = useMemo(() => new Map(lanterns.map((l) => [l.tag_id, l])), [lanterns])

  // Only rows that are on screen can stay ticked (filters may hide some).
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set([...prev].filter((t) => byTag.has(t)))
      return next.size === prev.size ? prev : next
    })
  }, [byTag])

  const hasBatch = (tag, field) => selected.has(tag) && Object.prototype.hasOwnProperty.call(batchValues, field)

  const changeList = useMemo(() => {
    const list = []
    const tags = new Set([...Object.keys(edits), ...(Object.keys(batchValues).length ? selected : [])])
    for (const tag_id of tags) {
      const e = edits[tag_id]
      const base = e?.base ?? byTag.get(tag_id)
      if (!base) continue
      const values = { ...(e?.values ?? {}), ...(selected.has(tag_id) ? batchValues : {}) }
      const fields = Object.entries(values).filter(([f, v]) => !cellsEqual(f, base[f], v))
      if (fields.length) list.push({ tag_id, base, fields })
    }
    return list
  }, [edits, batchValues, selected, byTag])
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
    if (hasBatch(lantern.tag_id, field)) return batchValues[field]
    const e = edits[lantern.tag_id]
    if (e && Object.prototype.hasOwnProperty.call(e.values, field)) return e.values[field]
    return cellText(field, lantern[field])
  }

  function isChanged(lantern, field) {
    if (hasBatch(lantern.tag_id, field)) return !cellsEqual(field, lantern[field], batchValues[field])
    const e = edits[lantern.tag_id]
    if (!e || !Object.prototype.hasOwnProperty.call(e.values, field)) return false
    return !cellsEqual(field, e.base[field], e.values[field])
  }

  function discardAll() {
    if (!window.confirm(`放棄 ${changedCellCount} 項未儲存的修改？ Discard all unsaved changes?`)) return
    setEdits({}); setBatchValues({}); setRowErrors({}); setMessage(null)
  }

  // Top-row value for a column. KEEP (or an empty text/number box) = leave that column alone.
  function setBatch(field, value) {
    setMessage(null)
    setBatchValues((prev) => {
      const next = { ...prev }
      if (value === KEEP || value === '') delete next[field]
      else next[field] = value
      return next
    })
  }

  function toggleRow(tag) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag); else next.add(tag)
      return next
    })
  }
  const allSelected = lanterns.length > 0 && lanterns.every((l) => selected.has(l.tag_id))
  const someSelected = selected.size > 0 && !allSelected
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(lanterns.map((l) => l.tag_id)))
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
        if (!Object.keys(errs).length) { setBatchValues({}); setSelected(new Set()) }
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
        <div className="bg-white rounded-lg border border-gray-200 p-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="font-medium text-gray-800">批次修改 Batch update</span>
          <span className="text-gray-600">
            ① 勾選左邊的燈籠 → ② 在表格最上面的<span className="text-blue-700 font-medium">藍色列</span>填入新值 → ③ 按「儲存修改」確認。所有勾選的燈籠都會改成那個值。
          </span>
          <span className={`ml-auto ${selected.size ? 'text-blue-700 font-medium' : 'text-gray-400'}`}>已勾選 {selected.size} 筆</span>
          {selected.size > 0 && (
            <button onClick={() => setSelected(new Set())} className="text-gray-500 hover:text-gray-900 underline">清除勾選</button>
          )}
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
                <th key={c.key} className={`px-2 py-2 text-left font-medium whitespace-nowrap border-b border-gray-200 ${FROZEN[c.key] ? `${FROZEN[c.key].cls} z-20 bg-gray-100` : ''}`}>
                  {i === 0 && canEdit ? (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-4 h-4"
                        checked={allSelected}
                        ref={(el) => { if (el) el.indeterminate = someSelected }}
                        onChange={toggleAll}
                        aria-label="全選 Select all shown"
                      />
                      {c.label}
                    </label>
                  ) : unavailable.has(c.key) ? (
                    <span title={UNAVAILABLE_TITLE} className="text-gray-400">{c.label} <span className="text-xs text-amber-700">⚠ 未啟用</span></span>
                  ) : c.label}
                </th>
              ))}
            </tr>
            {canEdit && (
              <tr className="bg-blue-50 text-blue-900">
                {columns.map((c, i) => {
                  const disabled = selected.size === 0 || unavailable.has(c.key)
                  const bv = Object.prototype.hasOwnProperty.call(batchValues, c.key) ? batchValues[c.key] : undefined
                  const cls = `w-full px-1.5 py-1 text-sm rounded border focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-40 disabled:cursor-not-allowed ${bv !== undefined ? 'bg-blue-100 border-blue-400 font-medium' : 'bg-white border-blue-200'}`
                  if (i === 0) {
                    return (
                      <th key={c.key} className={`${FROZEN.tag_id.cls} z-20 bg-blue-50 px-2 py-1.5 text-left font-medium whitespace-nowrap border-b border-blue-200`}>
                        批次 → {selected.size} 筆
                      </th>
                    )
                  }
                  const label = {
                    'aria-label': `批次 ${c.label}`,
                    disabled,
                    title: unavailable.has(c.key) ? UNAVAILABLE_TITLE : disabled ? '先勾選燈籠 Tick lanterns first' : `套用到 ${selected.size} 筆勾選的燈籠`,
                  }
                  return (
                    <th key={c.key} className={`px-1 py-1 font-normal border-b border-blue-200 ${FROZEN[c.key] ? `${FROZEN[c.key].cls} z-20 bg-blue-50` : c.width ?? ''}`}>
                      {c.type === 'select' ? (
                        <select {...label} value={bv ?? KEEP} onChange={(e) => setBatch(c.key, e.target.value)} className={cls}>
                          <option value={KEEP}>（不變）</option>
                          {c.options.map((o) => <option key={o.value} value={o.value}>{o.value === '' ? `清除 ${o.label}` : o.label}</option>)}
                        </select>
                      ) : c.type === 'checkbox' ? (
                        <select {...label} value={bv === undefined ? KEEP : String(bv)} onChange={(e) => setBatch(c.key, e.target.value === KEEP ? KEEP : e.target.value === 'true')} className={cls}>
                          <option value={KEEP}>（不變）</option>
                          <option value="true">✓ 是</option>
                          <option value="false">否</option>
                        </select>
                      ) : (
                        <input
                          {...label}
                          type={c.type === 'number' ? 'number' : 'text'}
                          min={c.min} max={c.max} step={c.step}
                          placeholder="（不變）"
                          value={bv ?? ''}
                          onChange={(e) => setBatch(c.key, e.target.value)}
                          className={cls}
                        />
                      )}
                    </th>
                  )
                })}
              </tr>
            )}
          </thead>
          <tbody>
            {lanterns.map((l, rowIdx) => {
              const err = rowErrors[l.tag_id]
              const isSel = canEdit && selected.has(l.tag_id)
              return (
                <tr key={l.id} className={`border-b border-gray-100 ${err ? 'bg-red-50' : isSel ? 'bg-blue-50/60' : 'hover:bg-blue-50/40'}`}>
                  {columns.map((c, colIdx) => {
                    const changed = isChanged(l, c.key)
                    const fromBatch = hasBatch(l.tag_id, c.key)
                    const tint = fromBatch && changed ? 'bg-blue-100' : changed ? 'bg-yellow-100' : ''
                    const frozen = FROZEN[c.key]
                    // Frozen cells need an opaque background so scrolled cells don't show through.
                    const cellCls = frozen
                      ? `px-1 py-0.5 align-top ${frozen.cls} z-[5] ${tint || (err ? 'bg-red-50' : isSel ? 'bg-blue-50' : 'bg-white')}`
                      : `px-1 py-0.5 align-top ${c.width ?? ''} ${tint}`
                    const hover = c.key === 'tag_id' || c.key === 'name_zh' ? previewHandlers(l) : {}
                    if (c.key === 'tag_id') {
                      return (
                        <td key={c.key} {...hover} className={`${cellCls} px-2 py-1.5`}>
                          {canEdit && (
                            <input
                              type="checkbox"
                              className="w-4 h-4 mr-2 align-middle"
                              checked={isSel}
                              onChange={() => toggleRow(l.tag_id)}
                              aria-label={`勾選 ${l.tag_id}`}
                            />
                          )}
                          {/* New tab, so unsaved table edits are not lost. */}
                          <Link href={`/inventory/lanterns/${l.tag_id}`} target="_blank" className="font-mono text-blue-700 hover:underline">{l.tag_id}</Link>
                          {!l.displayable && <span className="ml-1"><InventoryDisplayableBadge reasons={l.displayable_reasons} /></span>}
                          {err && <p className="text-xs text-red-700 whitespace-normal max-w-[14rem] mt-0.5">{err}</p>}
                        </td>
                      )
                    }
                    if (unavailable.has(c.key)) {
                      return <td key={c.key} title={UNAVAILABLE_TITLE} className={`${cellCls} px-2 py-1.5 whitespace-nowrap text-gray-300`}>—</td>
                    }
                    if (!canEdit) {
                      return <td key={c.key} {...hover} className={`${cellCls} px-2 py-1.5 whitespace-nowrap`}>{optionLabel(c, cellText(c.key, l[c.key])) || <span className="text-gray-300">—</span>}</td>
                    }
                    const v = valueOf(l, c.key)
                    const common = {
                      // A value coming from the 批次 row is changed there, not per cell.
                      disabled: fromBatch,
                      title: fromBatch ? '由最上面的批次列設定 Set by the batch row' : undefined,
                      'data-cell': `${rowIdx}-${colIdx}`,
                      'aria-label': `${l.tag_id} ${c.label}`,
                      onKeyDown: (ev) => onKeyDown(ev, rowIdx, colIdx),
                    }
                    return (
                      <td key={c.key} {...hover} className={cellCls}>
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

      {preview && (
        <div
          ref={previewRef}
          className="fixed left-0 top-0 z-40 w-[200px] bg-white rounded-lg shadow-lg border border-gray-200 p-2 pointer-events-none"
          style={{ transform: 'translate(-9999px, -9999px)' }}
          aria-hidden="true"
        >
          {preview.primary_photo_thumb_url ? (
            <img src={preview.primary_photo_thumb_url} alt="" className="w-full aspect-square object-cover rounded" />
          ) : (
            <div className="w-full aspect-square rounded bg-gray-100 flex items-center justify-center text-gray-400 text-sm">無照片 No photo</div>
          )}
          <p className="mt-1.5 text-xs font-mono text-gray-400">{preview.tag_id}</p>
          <p className="text-sm font-medium text-gray-900 truncate">{preview.name_zh}</p>
        </div>
      )}

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
