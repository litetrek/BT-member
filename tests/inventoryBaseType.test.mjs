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

import { normalizeSizeClass, formatSizeClass, SIZE_CLASS_OPTIONS } from '../lib/inventoryConstants.js'

test('size: 小 / 中 / 大 / 超大, blank = 未填, anything else rejected', () => {
  assert.deepEqual(SIZE_CLASS_OPTIONS.map((o) => o.zh), ['小', '中', '大', '超大'])
  assert.equal(normalizeSizeClass('Extra large'), 'Extra large')
  assert.equal(normalizeSizeClass(''), null)
  assert.equal(normalizeSizeClass('XL'), undefined)
  assert.equal(formatSizeClass('Medium'), '中 Medium')
  assert.equal(formatSizeClass('Extra large'), '超大 X-Large')
})
