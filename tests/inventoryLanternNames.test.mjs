import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeLanternNames, hasChinese } from '../lib/inventoryLanternNames.js'
import { buildLanternUpdate } from '../lib/inventoryLanternUpdate.js'

test('either name is enough; the other is marked missing', () => {
  assert.deepEqual(normalizeLanternNames(' 大海螺 ', ''), { name_zh: '大海螺', name_en: null, missing: 'en' })
  assert.deepEqual(normalizeLanternNames('', 'Big cone shell'), { name_zh: 'Big cone shell', name_en: 'Big cone shell', missing: 'zh' })
  assert.deepEqual(normalizeLanternNames('大海螺', 'Big cone shell'), { name_zh: '大海螺', name_en: 'Big cone shell', missing: null })
  assert.match(normalizeLanternNames(' ', null).error, /name/)
})

test('an English placeholder in name_zh is translated again later', () => {
  assert.equal(normalizeLanternNames('Big cone shell', 'Big cone shell').missing, 'zh')
  assert.equal(normalizeLanternNames('LED 燈', 'LED 燈').missing, null)
  assert.deepEqual(normalizeLanternNames('Seaweed', ''), { name_zh: 'Seaweed', name_en: 'Seaweed', missing: 'zh' })
  assert.equal(hasChinese('珊瑚'), true)
  assert.equal(hasChinese('Coral 2'), false)
})

const base = {
  id: 'x', tag_id: 'LT-0001', name_zh: '大海螺', name_en: null, category_id: null, qty: 1,
  voltage: null, power_w: null, height_ft: null, width_ft: null, depth_ft: null, location_id: null,
  condition: 'Good', cloth_damage_pct: 0, frame_damage_pct: 0, repair_ease: null, base_type: null,
  size_class: null, notes: null, status: 'Active', display_decision: null, label_attached: false,
}

test('translation is requested only when the edit touches a name', () => {
  assert.equal(buildLanternUpdate(base, { label_attached: true }).nameMissing, null)
  const legacy = buildLanternUpdate({ ...base, name_zh: 'Seaweed' }, { label_attached: true })
  assert.equal(legacy.next.name_en, null) // untouched names stay as they were
  const fixed = buildLanternUpdate({ ...base, name_zh: 'Seaweed' }, { name_zh: 'Seaweed', name_en: '' })
  assert.equal(fixed.nameMissing, 'zh')
  assert.equal(fixed.next.name_en, 'Seaweed')
  assert.equal(buildLanternUpdate(base, { name_zh: '大海螺', name_en: '' }).nameMissing, 'en')
  const r = buildLanternUpdate({ ...base, name_en: 'Shell' }, { name_zh: '' })
  assert.equal(r.nameMissing, 'zh')
  assert.equal(r.next.name_zh, 'Shell')
})
