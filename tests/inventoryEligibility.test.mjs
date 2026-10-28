import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateDisplayability } from '../lib/inventoryEligibility.js'
import { diffLanternFields, pickEventType } from '../lib/inventoryEventDiff.js'

test('displayable when both damages are under their thresholds', () => {
  assert.deepEqual(evaluateDisplayability({ cloth_damage_pct: 10, frame_damage_pct: 0 }, { cloth_pct: 20, frame_pct: 30 }),
    { displayable: true, reasons: [] })
})

test('returns a reason per failing threshold', () => {
  const r = evaluateDisplayability({ cloth_damage_pct: 25, frame_damage_pct: 40 }, { cloth_pct: 20, frame_pct: 30 })
  assert.equal(r.displayable, false)
  assert.equal(r.reasons.length, 2)
  assert.match(r.reasons[0], /布面損壞 25% ≥ 門檻 20%/)
  assert.match(r.reasons[1], /骨架損壞 40% ≥ 門檻 30%/)
})

test('reaching the threshold exactly is not displayable (pre-Phase-1 rule)', () => {
  assert.equal(evaluateDisplayability({ cloth_damage_pct: 30, frame_damage_pct: 0 }).displayable, false)
})

test('diff ignores pg numeric-string noise and reports real changes', () => {
  const before = { id: 'x', power_w: '12.50', qty: 2, status: 'Active', location_id: 'a' }
  const after = { id: 'x', power_w: 12.5, qty: 2, status: 'Missing', location_id: 'a' }
  assert.deepEqual(diffLanternFields(before, after), { status: ['Active', 'Missing'] })
  assert.equal(pickEventType({ status: ['Active', 'Missing'] }), 'status_changed')
  assert.equal(pickEventType({ location_id: ['a', 'b'] }), 'moved')
  assert.equal(pickEventType({ location_id: ['a', 'b'], qty: [1, 2] }), 'updated')
})
