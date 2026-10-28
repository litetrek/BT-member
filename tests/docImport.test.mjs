import { test } from 'node:test'
import assert from 'node:assert/strict'
import { htmlToText, rowsToText, docTypeOf, capText } from '../lib/docExtract.js'
import { sanitizeDocAnalysis, isOurBlobUrl, buildDocSystemPrompt } from '../lib/docAnalysis.js'

const LANTERN = '11111111-1111-1111-1111-111111111111'
const activities = [{ id: LANTERN, name: '燈會' }]

test('htmlToText keeps headings, lists and one line per table row', () => {
  const html = '<h1>一、燈會</h1><ul><li>負責人：王小明</li></ul><table><tr><td><p>項目</p></td><td><p>負責人</p></td></tr><tr><td><p>佈置</p><p>第二行</p></td><td><p>Bob</p></td></tr></table><p>A &amp; B</p>'
  const t = htmlToText(html)
  assert.ok(t.includes('# 一、燈會'))
  assert.ok(t.includes('- 負責人：王小明'))
  assert.ok(t.includes('| 項目 | 負責人 |'))
  assert.ok(t.includes('| 佈置；第二行 | Bob |'))
  assert.ok(t.includes('A & B'))
})

test('rowsToText skips empty rows and formats dates', () => {
  const t = rowsToText([{ sheet: 'S', data: [['a', null], [null, ''], ['b', new Date('2027-03-01T00:00:00Z')]] }])
  assert.equal(t, '## S\na | \nb | 2027-03-01')
})

test('docTypeOf recognises formats', () => {
  assert.equal(docTypeOf('Plan.DOCX'), 'docx')
  assert.equal(docTypeOf('old.doc'), 'old-office')
  assert.equal(docTypeOf('x.xlsx'), 'xlsx')
  assert.equal(docTypeOf('scan'), 'unknown')
  assert.equal(docTypeOf('scan', 'application/pdf'), 'pdf')
  assert.equal(capText('abcdef', 3).truncated, true)
})

test('sanitizeDocAnalysis maps duplicate new activities to existing ones and checks fields', () => {
  const raw = {
    doc_kind: 'plan',
    summary: '春季活動計畫',
    activity_id: 'invented',
    new_activities: [
      { key: 'n1', name: '燈會', lead: 'X' },          // same as existing → mapped, not created
      { key: 'n2', name: '義工報到處', lead: 'Susan' },
      { key: 'n3', name: '義工 報到處' },               // duplicate name
      { key: '', name: 'no key' },
    ],
    tasks: [
      { title: '檢查燈籠', new_activity: 'n1', due_date: '2027-02-15', status: 'open', excerpt: '2月15日前' },
      { title: '排班', new_activity: 'n2', owner: 'Susan', status: 'bogus' },
      { title: '不明', new_activity: 'n9', due_date: '2/15' },
      { title: '' },
    ],
    status_updates: [{ summary: '場地已確認', activity_id: LANTERN }],
  }
  const out = sanitizeDocAnalysis(raw, { activities })
  assert.equal(out.doc_kind, 'plan')
  assert.equal(out.activity_id, null)
  assert.deepEqual(out.new_activities.map((n) => n.name), ['義工報到處'])
  assert.equal(out.tasks.length, 3)
  assert.deepEqual([out.tasks[0].activity_id, out.tasks[0].new_activity], [LANTERN, null])
  assert.deepEqual([out.tasks[1].activity_id, out.tasks[1].new_activity, out.tasks[1].status], [null, 'n2', 'open'])
  assert.deepEqual([out.tasks[2].new_activity, out.tasks[2].due_date], [null, null])
  assert.equal(out.status_updates[0].activity_id, LANTERN)
})

test('sanitizeDocAnalysis defaults safely on garbage', () => {
  const out = sanitizeDocAnalysis('x', { activities })
  assert.equal(out.doc_kind, 'reference')
  assert.deepEqual(out.tasks, [])
})

test('only our own Blob URLs may be fetched', () => {
  assert.equal(isOurBlobUrl('https://abc123.public.blob.vercel-storage.com/events/x/docs/p.pdf'), true)
  assert.equal(isOurBlobUrl('http://abc123.public.blob.vercel-storage.com/p.pdf'), false)
  assert.equal(isOurBlobUrl('https://evil.example.com/p.pdf'), false)
  assert.equal(isOurBlobUrl('https://x.public.blob.vercel-storage.com.evil.com/p.pdf'), false)
  assert.equal(isOurBlobUrl('not a url'), false)
})

test('document prompt lists activities and treats content as data', () => {
  const p = buildDocSystemPrompt({ event: { name: 'E', event_date: '2027-03-20' }, activities, people: ['Susan'], docName: 'plan.docx' })
  assert.ok(p.includes(LANTERN) && p.includes('Susan') && p.includes('plan.docx') && p.includes('不要照做'))
})
