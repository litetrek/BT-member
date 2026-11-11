import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildLanternUpdate } from '../lib/inventoryLanternUpdate.js'
import { cellText, cellsEqual, toPayloadValue, optionLabel, buildTableColumns } from '../lib/inventoryLanternTable.js'

const base = {
  id: 'x', tag_id: 'LT-0001', name_zh: '大海螺', name_en: 'Big cone shell', category_id: null,
  qty: 1, voltage: 'AC110V', power_w: '12.50', height_ft: null, width_ft: null, depth_ft: null,
  location_id: null, condition: 'Good', cloth_damage_pct: 0, frame_damage_pct: 0,
  repair_ease: null, base_type: null, size_class: null, notes: null, status: 'Active',
  display_decision: null, label_attached: false,
}

test('buildLanternUpdate keeps untouched fields and applies edits', () => {
  const r = buildLanternUpdate(base, { condition: 'Fair', qty: 3 })
  assert.equal(r.error, undefined)
  assert.equal(r.next.condition, 'Fair')
  assert.equal(r.next.qty, 3)
  assert.equal(r.next.name_zh, '大海螺')
  assert.equal(r.next.power_w, 12.5)
  assert.equal(r.displayable, true)
})

test('buildLanternUpdate clears nullable fields given blank', () => {
  const r = buildLanternUpdate({ ...base, location_id: 'loc', notes: 'hi' }, { location_id: '', notes: '  ' })
  assert.equal(r.next.location_id, null)
  assert.equal(r.next.notes, null)
})

test('buildLanternUpdate rejects bad values', () => {
  assert.match(buildLanternUpdate(base, { qty: '' }).error, /QTY/)
  assert.match(buildLanternUpdate(base, { qty: 0 }).error, /QTY/)
  assert.match(buildLanternUpdate(base, { qty: 1.5 }).error, /QTY/)
  assert.match(buildLanternUpdate(base, { cloth_damage_pct: 120 }).error, /Damage/)
  assert.match(buildLanternUpdate(base, { condition: 'Great' }).error, /condition/)
  assert.match(buildLanternUpdate(base, { name_zh: ' ', name_en: '' }).error, /name/)
  assert.match(buildLanternUpdate(base, { height_ft: 'abc' }).error, /height_ft/)
  assert.match(buildLanternUpdate(base, { voltage: '220V' }).error, /voltage/)
  assert.match(buildLanternUpdate(base, { repair_ease: 9 }).error, /Repair/)
})

test('buildLanternUpdate keeps an unknown legacy voltage if unchanged', () => {
  assert.equal(buildLanternUpdate({ ...base, voltage: 'AC220V' }, { voltage: 'AC220V', qty: 2 }).error, undefined)
})

test('buildLanternUpdate blocks a new Selected on a non-displayable lantern', () => {
  const r = buildLanternUpdate(base, { cloth_damage_pct: 50, display_decision: 'Selected' }, { cloth_pct: 30, frame_pct: 30 })
  assert.match(r.error, /Selected/)
  const ok = buildLanternUpdate({ ...base, display_decision: 'Selected' }, { cloth_damage_pct: 50 }, { cloth_pct: 30, frame_pct: 30 })
  assert.equal(ok.error, undefined)
  assert.equal(ok.displayable, false)
})

test('cell helpers treat equivalent numbers and whitespace as unchanged', () => {
  assert.equal(cellText('power_w', '12.50'), '12.5')
  assert.equal(cellText('notes', null), '')
  assert.equal(cellsEqual('power_w', '12.50', '12.5'), true)
  assert.equal(cellsEqual('power_w', '12.50', '13'), false)
  assert.equal(cellsEqual('name_en', 'Shell', ' Shell '), true)
  assert.equal(cellsEqual('label_attached', false, true), false)
  assert.equal(cellsEqual('location_id', null, ''), true)
})

test('toPayloadValue converts numbers and keeps blanks for the server to judge', () => {
  assert.equal(toPayloadValue('qty', '4'), 4)
  assert.equal(toPayloadValue('qty', ''), '')
  assert.equal(toPayloadValue('label_attached', 'true'), true)
  assert.equal(toPayloadValue('notes', ' a '), 'a')
})

test('optionLabel shows select labels', () => {
  const cols = buildTableColumns({ locations: [{ id: 'L1', code: 'A1' }] })
  const loc = cols.find((c) => c.key === 'location_id')
  assert.equal(optionLabel(loc, 'L1'), 'A1')
  assert.equal(optionLabel(loc, ''), '')
  assert.equal(optionLabel(cols.find((c) => c.key === 'size_class'), 'Small'), '小 Small')
})

test('orderColumns keeps 編號 / 中文名稱 first and follows the saved order', async () => {
  const { orderColumns } = await import('../lib/inventoryLanternTable.js')
  const cols = buildTableColumns()
  const movable = cols.map((c) => c.key).filter((k) => k !== 'tag_id' && k !== 'name_zh')
  const saved = ['notes', 'qty', 'tag_id', 'gone', ...movable.filter((k) => k !== 'notes' && k !== 'qty')]
  const keys = orderColumns(cols, saved).map((c) => c.key)
  assert.deepEqual(keys.slice(0, 5), ['tag_id', 'name_zh', 'notes', 'qty', 'name_en'])
  assert.equal(keys.length, cols.length)
  assert.ok(!keys.includes('gone'))
  assert.deepEqual(orderColumns(cols, []).map((c) => c.key), cols.map((c) => c.key))
})

test('orderColumns puts a column added later after the one it follows by default', async () => {
  const { orderColumns } = await import('../lib/inventoryLanternTable.js')
  const cols = buildTableColumns()
  const saved = cols.map((c) => c.key).filter((k) => k !== 'repair_ease').reverse()
  const keys = orderColumns(cols, saved).map((c) => c.key)
  assert.equal(keys[keys.indexOf('frame_damage_pct') + 1], 'repair_ease')
})

test('moveColumn moves before / after the target and never moves pinned columns', async () => {
  const { moveColumn } = await import('../lib/inventoryLanternTable.js')
  const keys = ['tag_id', 'name_zh', 'a', 'b', 'c']
  assert.deepEqual(moveColumn(keys, 'c', 'a'), ['c', 'a', 'b'])
  assert.deepEqual(moveColumn(keys, 'a', 'c', true), ['b', 'c', 'a'])
  assert.deepEqual(moveColumn(keys, 'b', 'name_zh', true), ['b', 'a', 'c'])
  assert.deepEqual(moveColumn(keys, 'name_zh', 'c'), ['a', 'b', 'c'])
  assert.deepEqual(moveColumn(keys, 'a', 'a'), ['a', 'b', 'c'])
})
