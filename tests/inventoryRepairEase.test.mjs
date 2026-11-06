import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeRepairEase, formatRepairEase, REPAIR_EASE_LEVELS } from '../lib/inventoryConstants.js'
import { diffLanternFields } from '../lib/inventoryEventDiff.js'

test('repair ease accepts 0–5 integers, blank means not rated, rejects the rest', () => {
  assert.equal(normalizeRepairEase(0), 0)
  assert.equal(normalizeRepairEase('5'), 5)
  assert.equal(normalizeRepairEase(''), null)
  assert.equal(normalizeRepairEase(null), null)
  assert.equal(normalizeRepairEase(undefined), null)
  for (const bad of [6, -1, 2.5, 'abc']) assert.equal(normalizeRepairEase(bad), undefined)
})

test('labels: six levels, 0 no repair … 5 extensive; null shows 未評估', () => {
  assert.equal(REPAIR_EASE_LEVELS.length, 6)
  assert.equal(formatRepairEase(0), '0 · 不需修補')
  assert.equal(formatRepairEase(5), '5 · 需大幅修補')
  assert.equal(formatRepairEase(null), '未評估')
})

test('a repair ease change is recorded in the event log diff', () => {
  assert.deepEqual(diffLanternFields({ repair_ease: null }, { repair_ease: 2 }), { repair_ease: [null, 2] })
})
