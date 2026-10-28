import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toDateOnly, isOverdue, isPastDate, formatDateOnly, yearOf } from '../lib/dates.js'

test('toDateOnly accepts plain dates, ISO strings and Dates', () => {
  assert.equal(toDateOnly('2026-06-30'), '2026-06-30')
  assert.equal(toDateOnly('2026-06-30T07:00:00.000Z'), '2026-06-30')
  assert.equal(toDateOnly(null), null)
  assert.equal(toDateOnly('not a date'), null)
})

test('a task due today is not overdue; due yesterday is', () => {
  assert.equal(isOverdue({ status: 'open', due_date: '2026-10-28' }, '2026-10-28'), false)
  assert.equal(isOverdue({ status: 'open', due_date: '2026-10-27' }, '2026-10-28'), true)
  assert.equal(isOverdue({ status: 'done', due_date: '2026-10-01' }, '2026-10-28'), false)
  assert.equal(isOverdue({ status: 'open', due_date: null }, '2026-10-28'), false)
  assert.equal(isPastDate('2026-06-30', '2026-10-28'), true)
})

test('formatDateOnly never shifts the day and never returns Invalid Date', () => {
  assert.equal(formatDateOnly('2026-06-30', 'en-US', { month: 'short', day: 'numeric' }), 'Jun 30')
  assert.equal(formatDateOnly(undefined), '')
  assert.equal(yearOf('2026-06-30'), '2026')
})
