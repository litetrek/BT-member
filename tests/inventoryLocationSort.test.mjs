// Run: npm test   (Node's built-in runner, no extra dependency)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sortLocations, compareLocationCodes, groupLocationsByZone } from '../lib/inventoryLocationSort.js'

const codes = (list) => sortLocations(list).map((l) => (typeof l === 'string' ? l : l.code))

test('A11 follows A10 (numeric, not lexicographic)', () => {
  const out = codes(['A10', 'A2', 'A11', 'A1', 'A9'])
  assert.deepEqual(out, ['A1', 'A2', 'A9', 'A10', 'A11'])
  assert.ok(out.indexOf('A11') === out.indexOf('A10') + 1)
})

test('zones A→E, then named locations alphabetically, Cabin last here', () => {
  const out = codes(['Cabin', 'E3', 'B4', 'A11', 'C1', 'A10', 'D2', 'A1'])
  assert.deepEqual(out, ['A1', 'A10', 'A11', 'B4', 'C1', 'D2', 'E3', 'Cabin'])
  assert.equal(out.at(-1), 'Cabin')
})

test('named locations sort alphabetically after all zone codes', () => {
  assert.deepEqual(codes(['Storage', 'Cabin', 'A1', 'Barn']), ['A1', 'Barn', 'Cabin', 'Storage'])
})

test('accepts location objects and does not mutate input', () => {
  const input = [{ code: 'B2' }, { code: 'A11' }, { code: 'A3' }]
  const copy = JSON.stringify(input)
  assert.deepEqual(codes(input), ['A3', 'A11', 'B2'])
  assert.equal(JSON.stringify(input), copy)
})

test('compareLocationCodes is case-insensitive on the zone letter', () => {
  assert.ok(compareLocationCodes('a2', 'A10') < 0)
})

test('groupLocationsByZone keeps sorted order and unknown zones', () => {
  const groups = groupLocationsByZone([
    { code: 'Cabin', zone: 'Cabin' }, { code: 'A11', zone: 'A' }, { code: 'A10', zone: 'A' }, { code: 'F1', zone: 'F' },
  ])
  assert.deepEqual(groups.map((g) => g.zone), ['A', 'Cabin', 'F'])
  assert.deepEqual(groups[0].items.map((l) => l.code), ['A10', 'A11'])
})
