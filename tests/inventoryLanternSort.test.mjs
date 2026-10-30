import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sortLanterns, lanternTitle } from '../lib/inventoryLanternSort.js'

const CATS = ['ocean', 'heaven', 'forest']
const L = [
  { tag_id: 'LT-0005', name_zh: '鳳凰', name_en: 'Phoenix', category_id: 'heaven', location_code: 'A2', condition: 'Fair' },
  { tag_id: 'LT-0002', name_zh: '海草（小）', name_en: 'seaweed small', category_id: 'ocean', location_code: 'A11', condition: 'Good' },
  { tag_id: 'LT-0004', name_zh: 'Flying fish', name_en: null, category_id: 'ocean', location_code: 'A10', condition: 'Bad' },
  { tag_id: 'LT-0009', name_zh: '竹筍', name_en: 'Bamboo', category_id: null, location_code: null, condition: 'OK' },
  { tag_id: 'LT-0001', name_zh: '大葉', name_en: 'Big leaves', category_id: 'forest', location_code: 'Cabin', condition: 'Good' },
]
const tags = (list) => list.map((l) => l.tag_id)

test('default: category order, then English title (falls back to name_zh), uncategorized last', () => {
  assert.deepEqual(tags(sortLanterns(L, undefined, CATS)), ['LT-0004', 'LT-0002', 'LT-0005', 'LT-0001', 'LT-0009'])
})

test('location: natural order (A10 before A11), named after zones, unassigned last', () => {
  assert.deepEqual(tags(sortLanterns(L, 'location', CATS)), ['LT-0005', 'LT-0004', 'LT-0002', 'LT-0001', 'LT-0009'])
})

test('condition: Good → OK → Fair → Bad, ties by category then title', () => {
  assert.deepEqual(tags(sortLanterns(L, 'condition', CATS)), ['LT-0002', 'LT-0001', 'LT-0009', 'LT-0005', 'LT-0004'])
})

test('title is case-insensitive and does not mutate input', () => {
  const copy = JSON.stringify(L)
  sortLanterns(L, 'category', CATS)
  assert.equal(JSON.stringify(L), copy)
  assert.equal(lanternTitle({ name_zh: '龍', name_en: '' }), '龍')
})
