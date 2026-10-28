import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseWhatsApp, parsePastedText, withKeys, guessMember, detectDateOrder, toTranscript } from '../lib/chatImport.js'

// All sample lines are invented.

test('iPhone US export: brackets, seconds, narrow no-break space, multi-line, attachment', async () => {
  const raw = [
    '[9/4/26, 7:30:03 PM] BT Team: ‎Messages and calls are end-to-end encrypted.',
    '[9/4/26, 7:30:37 PM] Amy Chen: Lanterns arrived',
    'second line',
    '‎[9/25/26, 4:25:37 PM] Bob: ‎<attached: 00000085-PHOTO-2026-09-25-16-25-37.jpg>',
    '[10/1/26, 12:05:00 AM] Bob: midnight check',
  ].join('\r\n')
  const { messages, dateOrder, skippedSystem } = parseWhatsApp(raw)
  assert.equal(dateOrder, 'MDY')
  assert.equal(messages.length, 3)
  // The encryption notice has a "Name:" but is from the group itself; it stays a message
  // only if it looks like one, so just check the real ones:
  const amy = messages.find((m) => m.sender === 'Amy Chen')
  assert.equal(amy.at, '2026-09-04T19:30:37')
  assert.equal(amy.text, 'Lanterns arrived\nsecond line')
  const photo = messages.find((m) => m.attachment)
  assert.equal(photo.attachment, '00000085-PHOTO-2026-09-25-16-25-37.jpg')
  assert.equal(photo.text, '')
  assert.equal(messages.at(-1).at, '2026-10-01T00:05:00')
  assert.ok(skippedSystem >= 0)
})

test('Android export: dash separator, no seconds, file attached, media omitted, system line', () => {
  const raw = [
    '9/4/26, 7:30 PM - Messages and calls are end-to-end encrypted.',
    '9/4/26, 7:31 PM - Amy: hello',
    '9/5/26, 8:00 AM - Bob: IMG-20260905-WA0001.jpg (file attached)',
    '9/5/26, 8:01 AM - Bob: <Media omitted>',
  ].join('\n')
  const { messages, skippedSystem } = parseWhatsApp(raw)
  assert.equal(skippedSystem, 1)
  assert.equal(messages.length, 3)
  assert.equal(messages[0].at, '2026-09-04T19:31:00')
  assert.equal(messages[1].attachment, 'IMG-20260905-WA0001.jpg')
  assert.equal(messages[2].omittedMedia, true)
})

test('Day-first and 24-hour formats', () => {
  const raw = '[25/09/2026, 16:25:37] Amy: hi\n[26/09/2026, 09:00:00] Bob: ok'
  const { messages, dateOrder } = parseWhatsApp(raw)
  assert.equal(dateOrder, 'DMY')
  assert.equal(messages[0].at, '2026-09-25T16:25:37')
})

test('Chinese-locale export with 上午/下午', () => {
  const raw = '[2026/9/4 下午7:30:03] 王小明: 燈籠到了\n[2026/9/5 上午12:10:00] 王小明: 好'
  const { messages, dateOrder } = parseWhatsApp(raw)
  assert.equal(dateOrder, 'YMD')
  assert.equal(messages[0].at, '2026-09-04T19:30:03')
  assert.equal(messages[0].sender, '王小明')
  assert.equal(messages[1].at, '2026-09-05T00:10:00')
})

test('ambiguous dates default to month/day', () => {
  assert.equal(detectDateOrder(['3/4/26', '5/6/26']), 'MDY')
})

test('pasted SMS without headers becomes one message', () => {
  const now = new Date(2026, 9, 28, 14, 5, 0)
  const r = parsePastedText('Bottles arrived.\nTammy will announce.', '簡訊', now)
  assert.equal(r.format, 'pasted-text')
  assert.equal(r.messages.length, 1)
  assert.equal(r.messages[0].sender, '簡訊')
  assert.equal(r.messages[0].at, '2026-10-28T14:05:00')
})

test('message keys are stable and distinct', async () => {
  const a = await withKeys([{ index: 0, at: '2026-09-04T19:30:37', sender: 'A', text: 'x' }])
  const b = await withKeys([{ index: 5, at: '2026-09-04T19:30:37', sender: 'A', text: 'x' }])
  const c = await withKeys([{ index: 0, at: '2026-09-04T19:30:38', sender: 'A', text: 'x' }])
  assert.equal(a[0].key, b[0].key)
  assert.notEqual(a[0].key, c[0].key)
})

test('guessMember matches by name and email prefix', () => {
  const members = [
    { id: '1', name: 'Amy Chen', email: 'amy@example.com' },
    { id: '2', name: '王小明', email: 'xm@example.com' },
  ]
  assert.equal(guessMember('Amy Chen', members), '1')
  assert.equal(guessMember('amy', members), '1')
  assert.equal(guessMember('小明', members), '2')
  assert.equal(guessMember('Zed', members), null)
})

test('transcript numbers messages and marks photos', () => {
  const t = toTranscript([{ index: 7, at: '2026-09-25T16:25:37', sender: 'Bob', text: '', attachment: 'a.jpg' }])
  assert.equal(t, '#7 2026-09-25 16:25 Bob: [照片 #7]')
})
