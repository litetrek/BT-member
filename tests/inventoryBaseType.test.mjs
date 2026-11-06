import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeBaseType, formatBaseType, BASE_TYPE_OPTIONS } from '../lib/inventoryConstants.js'

test('base type: two options, blank = 未填, anything else rejected', () => {
  assert.deepEqual(BASE_TYPE_OPTIONS.map((o) => o.value), ['Metal base frame', 'Socket mount'])
  assert.equal(normalizeBaseType('Socket mount'), 'Socket mount')
  assert.equal(normalizeBaseType(''), null)
  assert.equal(normalizeBaseType(null), null)
  assert.equal(normalizeBaseType('socket'), undefined)
  assert.equal(formatBaseType('Metal base frame'), '底盤式 Metal base frame')
  assert.equal(formatBaseType(null), null)
})
