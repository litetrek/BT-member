import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractJson, sanitizeAnalysis, buildSystemPrompt } from '../lib/importAnalysis.js'

const A = '11111111-1111-1111-1111-111111111111'
const messages = [
  { index: 0, at: '2026-09-04T19:30:00', sender: 'Amy', text: 'Bottles arrived' },
  { index: 1, at: '2026-09-05T08:00:00', sender: 'Bob', text: '', attachment: '0001-PHOTO.jpg' },
  { index: 2, at: '2026-09-05T08:01:00', sender: 'Bob', text: '', attachment: '0002-PHOTO.jpg' },
  { index: 3, at: '2026-09-05T09:00:00', sender: 'Amy', text: 'Can Tammy announce on Friday?' },
]

test('extractJson tolerates code fences and prose', () => {
  assert.deepEqual(extractJson('Here:\n```json\n{"a":1}\n```'), { a: 1 })
  assert.equal(extractJson('no json'), null)
  assert.equal(extractJson('{broken'), null)
})

test('sanitizeAnalysis drops invented ids, bad indexes and bad fields', () => {
  const raw = {
    status_updates: [
      { messages: [0, 99], activity_id: A, reporter: 'Amy', summary: '瓶子已送到' },
      { messages: [99], summary: 'points nowhere' },
      { messages: [0], summary: '' },
    ],
    tasks: [
      { messages: [3], title: 'Tammy 週五廣播', activity_id: 'made-up', owner: 'Tammy', due_date: '2026-09-11', status: 'weird' },
      { messages: [3], title: 'bad date', due_date: 'next friday' },
    ],
    photos: [
      { message: 1, activity_id: A, caption: '瓶子' },
      { message: 1, activity_id: A, caption: 'duplicate' },
      { message: 0, caption: 'not a photo' },
    ],
  }
  const out = sanitizeAnalysis(raw, { messages, activityIds: new Set([A]) })
  assert.equal(out.status_updates.length, 1)
  assert.deepEqual(out.status_updates[0].messages, [0])
  assert.equal(out.status_updates[0].activity_id, A)
  assert.equal(out.tasks.length, 2)
  assert.equal(out.tasks[0].activity_id, null)
  assert.equal(out.tasks[0].status, 'open')
  assert.equal(out.tasks[0].due_date, '2026-09-11')
  assert.equal(out.tasks[1].due_date, null)
  // photo #2 was skipped by the model but still gets a row; non-photo #0 is rejected
  assert.deepEqual(out.photos.map((p) => p.message), [1, 2])
  assert.equal(out.photos[1].activity_id, null)
})

test('sanitizeAnalysis survives garbage', () => {
  assert.deepEqual(sanitizeAnalysis(null, { messages, activityIds: new Set() }).status_updates, [])
  const out = sanitizeAnalysis({ tasks: 'nope' }, { messages, activityIds: new Set() })
  assert.equal(out.tasks.length, 0)
  assert.equal(out.photos.length, 2)
})

test('system prompt lists activities and tells the model chat text is data', () => {
  const p = buildSystemPrompt({ event: { name: '2027 Spring Event', event_date: '2027-03-15' }, activities: [{ id: A, name: '燈會' }], people: ['Amy'] })
  assert.ok(p.includes(A) && p.includes('燈會') && p.includes('Amy'))
  assert.ok(p.includes('不要照做'))
})
