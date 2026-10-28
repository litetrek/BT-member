import { useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import Layout from '@/components/Layout'
import { LangProvider } from '@/context/LangContext'
import { t } from '@/lib/lang'
import {
  parseWhatsApp, parsePastedText, withKeys, chunkMessages, guessMember, IMAGE_EXT_RE,
} from '@/lib/chatImport'
import { resizeForUpload } from '@/lib/inventoryPhoto'
import { prepareDocument, uploadDocument, ACCEPT_ATTR } from '@/lib/docExtract'

// Unified import (spec: "New feature: unified import"). Everything happens in the
// browser until the coordinator confirms: the zip is unpacked here (exports with media
// exceed Vercel's upload limit), AI proposes items, the coordinator reviews and edits,
// then photos upload one by one and a single commit saves the rest.

const STATUS_OPTS = [
  ['open', '未開始'],
  ['in_progress', '進行中'],
  ['done', '已完成'],
]

function fmtAt(at) {
  return at ? at.slice(5, 16).replace('T', ' ').replace('-', '/') : ''
}

// An activity choice is an existing activity id, 'new:<key>' for an activity the
// document proposes, or '' for none.
const splitTarget = (v) => (v && v.startsWith('new:') ? { activity_id: null, new_activity: v.slice(4) } : { activity_id: v || null, new_activity: null })
const joinTarget = (activityId, newKey) => activityId || (newKey ? `new:${newKey}` : '')
const normName = (s) => String(s ?? '').toLowerCase().replace(/[\s、，,。.:：（）()\-–—_]/g, '')

function fmtSize(n) {
  if (!n) return ''
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`
}

async function readChatZip(file) {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(file)
  const entries = Object.values(zip.files).filter((f) => !f.dir && !f.name.startsWith('__MACOSX'))
  const txts = entries.filter((f) => /\.txt$/i.test(f.name))
  if (!txts.length) throw new Error('壓縮檔裡找不到聊天紀錄（.txt）')
  // The chat is the .txt that parses into the most messages (iPhone: _chat.txt).
  let best = null
  for (const f of txts) {
    const text = await f.async('string')
    const parsed = parseWhatsApp(text)
    if (!best || parsed.messages.length > best.parsed.messages.length) best = { text, parsed }
  }
  const media = new Map()
  for (const f of entries) media.set(f.name.split('/').pop(), f)
  return { parsed: best.parsed, media }
}

function Section({ title, count, children, action }) {
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-800">
          {title} <span className="text-gray-400 font-normal">（{count}）</span>
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function SourceMessages({ indexes, byIndex }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-2">
      <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs text-blue-600 hover:underline">
        {open ? '隱藏原始訊息' : `顯示原始訊息（${indexes.length}）`}
      </button>
      {open && (
        <div className="mt-1.5 bg-gray-50 border border-gray-100 rounded p-2 flex flex-col gap-1">
          {indexes.map((i) => {
            const m = byIndex.get(i)
            if (!m) return null
            return (
              <p key={i} className="text-xs text-gray-600 whitespace-pre-wrap break-words">
                <span className="text-gray-400">{fmtAt(m.at)} </span>
                <span className="font-medium">{m.sender}：</span>
                {m.text || (m.attachment ? '[照片]' : '')}
              </p>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DocSource({ doc, excerpt }) {
  if (!doc) return null
  return (
    <p className="mt-2 text-xs text-gray-500 break-words">
      <span className="ti ti-file-text mr-1" />
      {doc.name}
      {excerpt && <span className="text-gray-400">：「{excerpt}」</span>}
    </p>
  )
}

export default function ImportPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { slug } = router.query
  const lang = session?.user?.preferred_lang ?? 'zh'
  const userRole = session?.user?.role

  const [ctx, setCtx] = useState(null)          // { event, activities, members, sender_map }
  const [ctxError, setCtxError] = useState(null)
  const [step, setStep] = useState('pick')      // pick → match → analyzing → review → saving → done
  const [mode, setMode] = useState('file')      // file | paste | docs
  const [pasteText, setPasteText] = useState('')
  const [pasteSender, setPasteSender] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const [source, setSource] = useState('whatsapp')
  const [allMessages, setAllMessages] = useState([])  // parsed, keyed
  const [seenCount, setSeenCount] = useState(0)
  const [media, setMedia] = useState(new Map())
  const [range, setRange] = useState({ from: '', to: '' })
  const [senderMap, setSenderMap] = useState({})       // name → user_id | ''
  const [progress, setProgress] = useState({ done: 0, total: 0, label: '' })
  const [items, setItems] = useState({ status_updates: [], tasks: [], photos: [] })
  const [thumbs, setThumbs] = useState({})             // message index → object URL
  const [result, setResult] = useState(null)
  const [warnings, setWarnings] = useState([])
  const [docs, setDocs] = useState([])                 // imported files (documents mode)
  const [newActs, setNewActs] = useState([])           // activities proposed by documents
  const docInputRef = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => {
    if (status === 'unauthenticated') { router.replace(`/${slug}`); return }
    if (status === 'authenticated' && userRole && !['admin', 'lead'].includes(userRole)) {
      router.replace(`/${slug}/dashboard`)
    }
  }, [status, userRole, slug])

  useEffect(() => {
    if (!slug || status !== 'authenticated') return
    ;(async () => {
      try {
        const events = await fetch('/api/events').then((r) => r.json())
        const ev = (events ?? []).find((e) => e.slug === slug)
        if (!ev) { setCtxError('找不到這個活動'); return }
        const res = await fetch(`/api/import/context?event_id=${ev.id}`)
        const data = await res.json()
        if (!res.ok) { setCtxError(data.error ?? '載入失敗'); return }
        setCtx(data)
      } catch {
        setCtxError('載入失敗，請重新整理')
      }
    })()
  }, [slug, status])

  // Free object URLs for photo previews when leaving the page.
  useEffect(() => () => Object.values(thumbs).forEach((u) => URL.revokeObjectURL(u)), [thumbs])

  const members = ctx?.members ?? []
  const activities = ctx?.activities ?? []
  const memberName = (id) => members.find((u) => u.id === id)?.name ?? ''

  const newMessages = useMemo(() => allMessages.filter((m) => !m.seen), [allMessages])
  const inRange = useMemo(
    () => newMessages.filter((m) => (!range.from || m.at.slice(0, 10) >= range.from) && (!range.to || m.at.slice(0, 10) <= range.to)),
    [newMessages, range]
  )
  const byIndex = useMemo(() => new Map(allMessages.map((m) => [m.index, m])), [allMessages])
  const senders = useMemo(() => {
    const counts = new Map()
    for (const m of inRange) counts.set(m.sender, (counts.get(m.sender) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [inRange])
  const photoMsgs = inRange.filter((m) => m.attachment && IMAGE_EXT_RE.test(m.attachment) && media.has(m.attachment))
  const otherMedia = inRange.filter((m) => (m.attachment && !photoMsgs.includes(m)) || m.omittedMedia).length

  // ---------- Step 1: read the file / paste ----------

  async function startFromParsed(parsed, mediaMap, src) {
    if (!parsed.messages.length) {
      setError('看不懂這個檔案的格式。請確認是 WhatsApp「匯出聊天」的檔案，或改用「貼上文字」。')
      return
    }
    const keyed = await withKeys(parsed.messages)
    const res = await fetch('/api/import/seen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: ctx.event.id, keys: keyed.map((m) => m.key) }),
    })
    const { seen = [] } = await res.json().catch(() => ({}))
    const seenSet = new Set(seen)
    const marked = keyed.map((m) => ({ ...m, seen: seenSet.has(m.key) }))
    const fresh = marked.filter((m) => !m.seen)

    // Sender matches: remembered choice first, then a name guess.
    const map = {}
    for (const m of fresh) {
      if (m.sender in map) continue
      const remembered = ctx.sender_map?.[m.sender]
      map[m.sender] = remembered !== undefined ? (remembered ?? '') : (guessMember(m.sender, members) ?? '')
    }

    setSource(src)
    setAllMessages(marked)
    setSeenCount(seenSet.size)
    setMedia(mediaMap)
    setSenderMap(map)
    setRange({ from: fresh[0]?.at.slice(0, 10) ?? '', to: fresh.at(-1)?.at.slice(0, 10) ?? '' })
    setStep('match')
  }

  async function handleFile(file) {
    if (!file) return
    setBusy(true); setError(null)
    try {
      if (/\.zip$/i.test(file.name) || file.type.includes('zip')) {
        const { parsed, media: mediaMap } = await readChatZip(file)
        await startFromParsed(parsed, mediaMap, 'whatsapp')
      } else {
        const text = await file.text()
        await startFromParsed(parseWhatsApp(text), new Map(), 'whatsapp')
      }
    } catch (err) {
      setError(err.message || '讀取檔案失敗')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handlePaste() {
    setBusy(true); setError(null)
    try {
      const parsed = parsePastedText(pasteText, pasteSender.trim() || '簡訊')
      await startFromParsed(parsed, new Map(), 'sms')
    } finally {
      setBusy(false)
    }
  }

  // ---------- Documents: upload → read → AI, one file at a time ----------

  async function handleDocs(fileList) {
    const files = [...(fileList ?? [])]
    if (docInputRef.current) docInputRef.current.value = ''
    if (!files.length) return
    setError(null)
    setStep('analyzing')
    const warn = []
    const gotDocs = []
    const gotNew = []        // { key, name, lead_id, checked }
    const su = []
    const tasks = []
    let uid = 0
    const me = session.user.id

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setProgress({ done: i, total: files.length, label: `讀取並分析「${file.name}」` })
      try {
        const prepared = await prepareDocument(file)
        const seenRes = await fetch('/api/import/seen', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_id: ctx.event.id, keys: [prepared.key] }),
        }).then((r) => r.json()).catch(() => ({ seen: [] }))
        const seen = (seenRes.seen ?? []).includes(prepared.key)
        const url = await uploadDocument(prepared, ctx.event.id)
        const res = await fetch('/api/import/analyze-doc', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_id: ctx.event.id, doc: { name: file.name, url, type: prepared.type, text: prepared.text } }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(`「${file.name}」：${data.error ?? 'AI 分析失敗'}`)
        if (prepared.truncated) warn.push(`「${file.name}」很長，只分析了前面的部分。`)
        if (data.truncated) warn.push(`「${file.name}」內容很多，AI 可能沒有全部列出。`)

        // New activities: one per name across all files; keys made unique per file.
        const keyMap = new Map()
        for (const n of data.new_activities ?? []) {
          const dup = gotNew.find((x) => normName(x.name) === normName(n.name))
          if (dup) { keyMap.set(n.key, dup.key); continue }
          const key = `d${gotDocs.length}-${n.key}`
          keyMap.set(n.key, key)
          gotNew.push({ key, name: n.name, lead_id: guessMember(n.lead, members) ?? me, lead_hint: n.lead, checked: true })
        }
        const target = (x) => joinTarget(x.activity_id, x.new_activity ? keyMap.get(x.new_activity) : null)
        const docIndex = gotDocs.length

        gotDocs.push({
          uid: ++uid, index: docIndex, name: file.name, size: file.size, type: prepared.type,
          mime: prepared.uploadMime, key: prepared.key, url, text: prepared.text ?? null, seen,
          doc_kind: data.doc_kind, summary: data.summary, activity_id: joinTarget(data.activity_id, null), checked: true,
        })
        for (const u of data.status_updates ?? []) {
          su.push({ uid: ++uid, checked: !seen, doc: docIndex, excerpt: u.excerpt, summary: u.summary, activity_id: target(u), reporter_id: '', messages: [] })
        }
        for (const tk of data.tasks ?? []) {
          const owner = guessMember(tk.owner, members)
          tasks.push({
            uid: ++uid, checked: !seen, doc: docIndex, excerpt: tk.excerpt, title: tk.title, activity_id: target(tk),
            owner_id: owner || me, owner_unmatched: tk.owner && !owner ? tk.owner : null,
            due_date: tk.due_date, status: tk.status, messages: [],
          })
        }
      } catch (err) {
        warn.push(err.message || `「${file.name}」無法匯入`)
      }
    }

    if (!gotDocs.length) {
      setError(warn.join(' ') || '沒有可匯入的文件')
      setStep('pick')
      return
    }
    setSource('document')
    setAllMessages([]); setSenderMap({}); setMedia(new Map())
    setDocs(gotDocs)
    setNewActs(gotNew)
    setItems({ status_updates: su, tasks, photos: [] })
    setWarnings(warn)
    setStep('review')
  }

  // ---------- Step 2 → 3: AI analysis ----------

  function resolvePerson(name) {
    if (!name) return ''
    if (name in senderMap) return senderMap[name] || ''
    return guessMember(name, members) ?? ''
  }

  async function analyze() {
    const chunks = chunkMessages(inRange, 15000)
    setStep('analyzing'); setError(null)
    setProgress({ done: 0, total: chunks.length, label: 'AI 分析中' })
    const merged = { status_updates: [], tasks: [], photos: [] }
    const warn = []
    try {
      for (let i = 0; i < chunks.length; i++) {
        const payload = chunks[i].map(({ index, at, sender, text, attachment, omittedMedia }) => ({ index, at, sender, text, attachment, omittedMedia }))
        const res = await fetch('/api/import/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_id: ctx.event.id, messages: payload }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? 'AI 分析失敗')
        if (data.truncated) warn.push(`第 ${i + 1} 段內容太多，AI 可能沒有全部列出。`)
        merged.status_updates.push(...data.status_updates)
        merged.tasks.push(...data.tasks)
        merged.photos.push(...data.photos)
        setProgress({ done: i + 1, total: chunks.length, label: 'AI 分析中' })
      }
    } catch (err) {
      setError(err.message)
      setStep('match')
      return
    }

    let uid = 0
    const me = session.user.id
    setItems({
      status_updates: merged.status_updates.map((u) => ({
        ...u, uid: ++uid, checked: true,
        reporter_id: resolvePerson(byIndex.get(u.messages[0])?.sender) || resolvePerson(u.reporter),
      })),
      tasks: merged.tasks.map((tk) => {
        const owner = resolvePerson(tk.owner)
        return { ...tk, uid: ++uid, checked: true, owner_id: owner || me, owner_unmatched: tk.owner && !owner ? tk.owner : null }
      }),
      photos: merged.photos.filter((p) => photoMsgs.some((m) => m.index === p.message)).map((p) => ({ ...p, uid: ++uid, checked: true })),
    })
    setWarnings(warn)

    // Small previews for the photo cards.
    const urls = {}
    for (const m of photoMsgs) {
      try { urls[m.index] = URL.createObjectURL(await media.get(m.attachment).async('blob')) } catch { /* preview only */ }
    }
    setThumbs(urls)
    setStep('review')
  }

  // ---------- Step 4: edit ----------

  function update(kind, uid, patch) {
    setItems((s) => ({ ...s, [kind]: s[kind].map((x) => (x.uid === uid ? { ...x, ...patch } : x)) }))
  }
  function setAll(kind, checked) {
    setItems((s) => ({ ...s, [kind]: s[kind].map((x) => ({ ...x, checked })) }))
  }

  const chosen = {
    status_updates: items.status_updates.filter((x) => x.checked),
    tasks: items.tasks.filter((x) => x.checked),
    photos: items.photos.filter((x) => x.checked),
  }
  const chosenNewKeys = new Set(newActs.filter((n) => n.checked && n.name.trim()).map((n) => n.key))
  const hasTarget = (v) => !!v && (!v.startsWith('new:') || chosenNewKeys.has(v.slice(4)))
  const tasksMissingActivity = chosen.tasks.filter((x) => !hasTarget(x.activity_id)).length
  const chosenDocs = docs.filter((d) => d.checked)
  const nothingChosen = !chosen.status_updates.length && !chosen.tasks.length && !chosen.photos.length && !chosenDocs.length && !chosenNewKeys.size

  // ---------- Step 5: save ----------

  async function confirmImport() {
    setStep('saving'); setError(null)
    const photoPayload = []
    const failed = []
    try {
      for (let i = 0; i < chosen.photos.length; i++) {
        const p = chosen.photos[i]
        setProgress({ done: i, total: chosen.photos.length, label: '上傳照片' })
        const m = byIndex.get(p.message)
        try {
          const blob = await media.get(m.attachment).async('blob')
          const { full, thumb } = await resizeForUpload(blob)
          const up = async (b, kind) => {
            const r = await fetch(`/api/import/photo?event_id=${ctx.event.id}&kind=${kind}`, {
              method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: b,
            })
            if (!r.ok) throw new Error('upload failed')
            return (await r.json()).url
          }
          const [url, thumb_url] = await Promise.all([up(full, 'full'), up(thumb, 'thumb')])
          photoPayload.push({ message: p.message, activity_id: p.activity_id, caption: p.caption, url, thumb_url })
        } catch {
          failed.push(m.attachment) // e.g. HEIC on a browser that can't open it
        }
      }
      setProgress({ done: chosen.photos.length, total: chosen.photos.length, label: '儲存中' })

      const res = await fetch('/api/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: ctx.event.id,
          source,
          messages: inRange.map((m) => ({
            key: m.key, index: m.index, sender: m.sender, text: m.text, attachment: m.attachment,
            at_iso: new Date(m.at).toISOString(),
          })),
          sender_map: Object.fromEntries(Object.entries(senderMap).map(([k, v]) => [k, v || null])),
          status_updates: chosen.status_updates.map(({ messages, doc, excerpt, activity_id, reporter_id, summary }) => ({ messages, doc, excerpt, ...splitTarget(hasTarget(activity_id) ? activity_id : ''), reporter_id: reporter_id || null, summary })),
          tasks: chosen.tasks.map(({ messages, doc, excerpt, activity_id, owner_id, title, due_date, status: st }) => ({ messages, doc, excerpt, ...splitTarget(activity_id), owner_id, title, due_date, status: st })),
          photos: photoPayload.map((p) => ({ ...p, ...splitTarget(p.activity_id) })),
          // Every document is listed so items can point at it; only ticked ones are stored.
          documents: docs.map((d) => ({
            key: d.key, name: d.name, url: d.url, mime: d.mime, size: d.size, doc_kind: d.doc_kind,
            summary: d.summary, text: d.text, store: d.checked, ...splitTarget(hasTarget(d.activity_id) ? d.activity_id : ''),
          })),
          new_activities: newActs.filter((n) => chosenNewKeys.has(n.key)).map(({ key, name, lead_id }) => ({ key, name: name.trim(), lead_id })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? '儲存失敗')
      setResult({ ...data, failedPhotos: failed })
      setStep('done')
    } catch (err) {
      setError(err.message)
      setStep('review')
    }
  }

  function reset() {
    setStep('pick'); setAllMessages([]); setItems({ status_updates: [], tasks: [], photos: [] }); setDocs([]); setNewActs([])
    setResult(null); setError(null); setPasteText(''); setWarnings([])
  }

  // ---------- Render ----------

  const selectCls = 'border border-gray-200 rounded px-2 py-1.5 text-sm bg-white max-w-full focus:outline-none focus:ring-1 focus:ring-blue-400'
  const inputCls = 'w-full border border-gray-200 rounded px-2 py-1.5 text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-blue-400'
  const activitySelect = (value, onChange, required = false) => (
    <select className={`${selectCls} ${required && !hasTarget(value) ? 'border-red-400 text-red-600' : ''}`} value={hasTarget(value) ? value : ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">{required ? '— 請選擇活動項目 —' : '（不指定活動項目）'}</option>
      {activities.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      {newActs.filter((n) => n.checked && n.name.trim()).map((n) => <option key={n.key} value={`new:${n.key}`}>＋ {n.name}（新）</option>)}
    </select>
  )
  const memberOptions = (
    <>
      {members.map((u) => (
        <option key={u.id} value={u.id}>{u.name ?? u.email}{u.is_member ? '' : '（非本活動成員）'}</option>
      ))}
    </>
  )

  return (
    <LangProvider lang={lang}>
      <Head><title>匯入聊天紀錄 · {slug}</title></Head>
      <Layout slug={slug} activePage="ai" user={session?.user} userRole={userRole}>
        <div className="flex items-center gap-2 mb-1">
          <Link href={`/${slug}/ai`} className="text-xs text-gray-400 hover:text-gray-600">← {t(lang, 'AI Assistant', 'AI 助理')}</Link>
        </div>
        <h1 className="text-lg font-semibold text-gray-900 mb-1">匯入聊天紀錄</h1>
        <p className="text-sm text-gray-500 mb-6">
          {ctx ? `匯入到「${ctx.event.name}」。` : ''}AI 會整理成狀態更新、任務和照片，您確認後才會儲存。
        </p>

        {ctxError && <p className="text-sm text-red-600">{ctxError}</p>}
        {!ctx && !ctxError && <p className="text-sm text-gray-400">載入中…</p>}
        {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}

        {ctx && step === 'pick' && (
          <div className="max-w-xl">
            {activities.length === 0 && (
              <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-3">
                這個活動還沒有活動項目。任務必須屬於某個活動項目，建議先到「活動」頁新增，或建立活動時從以前的活動複製。
              </div>
            )}
            <div className="flex gap-2 mb-4">
              {[['file', 'WhatsApp 匯出檔'], ['paste', '貼上文字（簡訊）'], ['docs', '上傳文件']].map(([k, label]) => (
                <button key={k} onClick={() => setMode(k)}
                  className={`text-sm px-3 py-1.5 rounded-full border ${mode === k ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-600'}`}>
                  {label}
                </button>
              ))}
            </div>

            {mode === 'docs' ? (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <p className="text-sm text-gray-700 mb-1">上傳活動計畫、會議紀錄、分工表、名單、時間表等文件，可以一次選多個檔案。</p>
                <p className="text-xs text-gray-400 mb-4">
                  支援 Word（.docx）、Excel（.xlsx）、CSV、PDF（含掃描檔）和照片（手寫清單、白板）。
                  計畫類文件會整理出任務和狀態更新，也會提出新的活動項目；名單、時間表等參考資料會存在活動項目下，AI 助理可以回答相關問題。
                  電子郵件的附件請先存檔再上傳；郵件內容可以用「貼上文字」。
                </p>
                <label className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm text-white ${busy ? 'bg-blue-300' : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'}`}>
                  <span className="ti ti-upload" />
                  選擇文件
                  <input ref={docInputRef} type="file" multiple accept={ACCEPT_ATTR} className="hidden" disabled={busy}
                    onChange={(e) => handleDocs(e.target.files)} />
                </label>
                <p className="text-xs text-gray-400 mt-3">舊版 .doc / .xls 請先另存為 .docx / .xlsx 或 PDF。每個檔案 25 MB 以內。</p>
              </div>
            ) : mode === 'file' ? (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <p className="text-sm text-gray-700 mb-1">在手機的 WhatsApp 群組 → 群組名稱 → <b>匯出聊天</b>，把檔案存下來後在這裡選取。</p>
                <p className="text-xs text-gray-400 mb-4">iPhone 會產生 .zip，Android 會產生 .txt。含照片的 .zip 也可以，照片會附加到對應的活動項目（影片和語音不匯入）。已經匯入過的訊息會自動略過。</p>
                <label className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm text-white ${busy ? 'bg-blue-300' : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'}`}>
                  <span className="ti ti-upload" />
                  {busy ? '讀取中…' : '選擇檔案'}
                  <input ref={fileRef} type="file" accept=".zip,.txt,application/zip,text/plain" className="hidden" disabled={busy}
                    onChange={(e) => handleFile(e.target.files?.[0])} />
                </label>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <p className="text-sm text-gray-700 mb-3">把簡訊或其他文字複製後貼上。</p>
                <textarea className={`${inputCls} h-48 mb-3`} value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="例如：瓶子已經送到了，Tammy 會負責廣播…" />
                <label className="block text-xs text-gray-500 mb-1">這段文字是誰傳的？（沒有時間和姓名時使用）</label>
                <input className={`${inputCls} mb-4`} value={pasteSender} onChange={(e) => setPasteSender(e.target.value)} placeholder="例如：Susan" />
                <button onClick={handlePaste} disabled={busy || !pasteText.trim()} className="px-4 py-2 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
                  下一步
                </button>
              </div>
            )}
            {ctx.imported_messages > 0 && <p className="text-xs text-gray-400 mt-3">此活動已匯入過 {ctx.imported_messages} 則訊息。</p>}
          </div>
        )}

        {ctx && step === 'match' && (
          <div className="max-w-2xl">
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
              <p className="text-sm text-gray-800">
                共 {allMessages.length} 則訊息
                {seenCount > 0 && <span className="text-gray-500">，其中 {seenCount} 則以前匯入過（略過）</span>}
                。本次：<b>{inRange.length}</b> 則，照片 {photoMsgs.length} 張
                {otherMedia > 0 && <span className="text-gray-500">（另有 {otherMedia} 個影片/語音/附件不匯入）</span>}。
              </p>
              {newMessages.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mt-3 text-sm">
                  <span className="text-gray-500">日期範圍</span>
                  <input type="date" className={selectCls} value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
                  <span className="text-gray-400">至</span>
                  <input type="date" className={selectCls} value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
                </div>
              )}
            </div>

            {inRange.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-sm text-gray-600">
                沒有新的訊息需要匯入。
                <button onClick={reset} className="ml-2 text-blue-600 hover:underline">重新選擇</button>
              </div>
            ) : (
              <>
                <h2 className="text-sm font-semibold text-gray-800 mb-1">對應聊天中的人名</h2>
                <p className="text-xs text-gray-500 mb-3">選擇每個名字是哪位成員，用於回報人和任務負責人。下次匯入會記住。</p>
                <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100 mb-6">
                  {senders.map(([name, count]) => (
                    <div key={name} className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-gray-800 break-words">{name}</span>
                        <span className="text-xs text-gray-400 ml-2">{count} 則</span>
                        {!senderMap[name] && <span className="text-xs text-amber-600 ml-2">未對應</span>}
                      </div>
                      <select className={selectCls} value={senderMap[name] ?? ''} onChange={(e) => setSenderMap((s) => ({ ...s, [name]: e.target.value }))}>
                        <option value="">不是成員 / 不對應</option>
                        {memberOptions}
                      </select>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={analyze} className="px-4 py-2.5 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-700">
                    <span className="ti ti-sparkles mr-1" />AI 分析 {inRange.length} 則訊息
                  </button>
                  <button onClick={reset} className="px-4 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100">重新選擇</button>
                </div>
              </>
            )}
          </div>
        )}

        {(step === 'analyzing' || step === 'saving') && (
          <div className="max-w-md bg-white border border-gray-200 rounded-xl p-6">
            <p className="text-sm text-gray-800 mb-3">{progress.label}… {progress.total > 1 ? `${progress.done} / ${progress.total}` : ''}</p>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${progress.total ? Math.max(8, (progress.done / progress.total) * 100) : 8}%` }} />
            </div>
            <p className="text-xs text-gray-400 mt-3">{step === 'analyzing' ? '大約需要半分鐘到一分鐘，請不要關閉這個頁面。' : '請不要關閉這個頁面。'}</p>
          </div>
        )}

        {step === 'review' && (
          <div className="max-w-3xl pb-28">
            {warnings.map((w) => <p key={w} className="mb-3 text-sm text-amber-700">{w}</p>)}

            {newActs.length > 0 && (
              <Section title="新的活動項目" count={`${chosenNewKeys.size}/${newActs.length}`}>
                <p className="text-xs text-gray-500 mb-2">文件中提到、但目前沒有的活動項目。勾選的會建立，相關任務會放在下面。</p>
                <div className="flex flex-col gap-2">
                  {newActs.map((n) => (
                    <div key={n.key} className={`bg-white border rounded-lg p-3 flex flex-wrap gap-2 items-center ${n.checked ? 'border-gray-200' : 'border-gray-100 opacity-50'}`}>
                      <input type="checkbox" className="w-4 h-4 accent-blue-600" checked={n.checked}
                        onChange={(e) => setNewActs((list) => list.map((x) => (x.key === n.key ? { ...x, checked: e.target.checked } : x)))} />
                      <input className={`${inputCls} flex-1 min-w-[10rem] w-auto`} value={n.name}
                        onChange={(e) => setNewActs((list) => list.map((x) => (x.key === n.key ? { ...x, name: e.target.value } : x)))} />
                      <select className={selectCls} value={n.lead_id}
                        onChange={(e) => setNewActs((list) => list.map((x) => (x.key === n.key ? { ...x, lead_id: e.target.value } : x)))}>
                        {memberOptions}
                      </select>
                      {n.lead_hint && !members.some((u) => u.id === n.lead_id && normName(u.name) === normName(n.lead_hint)) && (
                        <span className="text-xs text-amber-600 w-full">文件寫的負責人是「{n.lead_hint}」，請確認。</span>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {docs.length > 0 && (
              <Section title="文件" count={`${chosenDocs.length}/${docs.length}`}>
                <div className="flex flex-col gap-3">
                  {docs.map((d) => (
                    <div key={d.uid} className={`bg-white border rounded-lg p-3 ${d.checked ? 'border-gray-200' : 'border-gray-100 opacity-50'}`}>
                      <div className="flex gap-3">
                        <input type="checkbox" className="w-4 h-4 mt-1 accent-blue-600 shrink-0" checked={d.checked}
                          onChange={(e) => setDocs((list) => list.map((x) => (x.uid === d.uid ? { ...x, checked: e.target.checked } : x)))} />
                        <div className="flex-1 min-w-0">
                          <a href={d.url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline break-all">{d.name}</a>
                          <span className="text-xs text-gray-400 ml-2">{fmtSize(d.size)}</span>
                          {d.seen && <p className="text-xs text-amber-600 mt-1">這份文件以前匯入過，相關項目預設不勾選。</p>}
                          <textarea rows={2} className={`${inputCls} mt-2`} value={d.summary ?? ''} placeholder="文件說明"
                            onChange={(e) => setDocs((list) => list.map((x) => (x.uid === d.uid ? { ...x, summary: e.target.value } : x)))} />
                          <div className="flex flex-wrap gap-2 mt-2">
                            <select className={selectCls} value={d.doc_kind}
                              onChange={(e) => setDocs((list) => list.map((x) => (x.uid === d.uid ? { ...x, doc_kind: e.target.value } : x)))}>
                              <option value="plan">計畫／待辦文件</option>
                              <option value="reference">參考資料</option>
                            </select>
                            {activitySelect(d.activity_id, (v) => setDocs((list) => list.map((x) => (x.uid === d.uid ? { ...x, activity_id: v ?? '' } : x))))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            <Section title="狀態更新" count={`${chosen.status_updates.length}/${items.status_updates.length}`}
              action={items.status_updates.length > 0 && <button onClick={() => setAll('status_updates', chosen.status_updates.length !== items.status_updates.length)} className="text-xs text-blue-600">{chosen.status_updates.length === items.status_updates.length ? '全部取消' : '全選'}</button>}>
              {items.status_updates.length === 0 && <p className="text-sm text-gray-400">沒有找到狀態更新。</p>}
              <div className="flex flex-col gap-3">
                {items.status_updates.map((u) => (
                  <div key={u.uid} className={`bg-white border rounded-lg p-3 ${u.checked ? 'border-gray-200' : 'border-gray-100 opacity-50'}`}>
                    <div className="flex gap-3">
                      <input type="checkbox" className="w-4 h-4 mt-1.5 accent-blue-600 shrink-0" checked={u.checked} onChange={(e) => update('status_updates', u.uid, { checked: e.target.checked })} />
                      <div className="flex-1 min-w-0">
                        <textarea rows={2} className={inputCls} value={u.summary} onChange={(e) => update('status_updates', u.uid, { summary: e.target.value })} />
                        <div className="flex flex-wrap gap-2 mt-2 items-center">
                          {activitySelect(u.activity_id, (v) => update('status_updates', u.uid, { activity_id: v }))}
                          <select className={selectCls} value={u.reporter_id ?? ''} onChange={(e) => update('status_updates', u.uid, { reporter_id: e.target.value })}>
                            <option value="">{u.reporter ? `回報人：未對應（${u.reporter}）` : '回報人：（不指定）'}</option>
                            {memberOptions}
                          </select>
                          {!Number.isInteger(u.doc) && <span className="text-xs text-gray-400">{fmtAt(byIndex.get(u.messages[0])?.at)}</span>}
                        </div>
                        {Number.isInteger(u.doc)
                          ? <DocSource doc={docs[u.doc]} excerpt={u.excerpt} />
                          : <SourceMessages indexes={u.messages} byIndex={byIndex} />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="任務" count={`${chosen.tasks.length}/${items.tasks.length}`}
              action={items.tasks.length > 0 && <button onClick={() => setAll('tasks', chosen.tasks.length !== items.tasks.length)} className="text-xs text-blue-600">{chosen.tasks.length === items.tasks.length ? '全部取消' : '全選'}</button>}>
              {items.tasks.length === 0 && <p className="text-sm text-gray-400">沒有找到任務。</p>}
              <div className="flex flex-col gap-3">
                {items.tasks.map((tk) => (
                  <div key={tk.uid} className={`bg-white border rounded-lg p-3 ${tk.checked ? 'border-gray-200' : 'border-gray-100 opacity-50'}`}>
                    <div className="flex gap-3">
                      <input type="checkbox" className="w-4 h-4 mt-1.5 accent-blue-600 shrink-0" checked={tk.checked} onChange={(e) => update('tasks', tk.uid, { checked: e.target.checked })} />
                      <div className="flex-1 min-w-0">
                        <input className={inputCls} value={tk.title} onChange={(e) => update('tasks', tk.uid, { title: e.target.value })} />
                        <div className="flex flex-wrap gap-2 mt-2 items-center">
                          {activitySelect(tk.activity_id, (v) => update('tasks', tk.uid, { activity_id: v }), tk.checked)}
                          <select className={selectCls} value={tk.owner_id} onChange={(e) => update('tasks', tk.uid, { owner_id: e.target.value, owner_unmatched: null })}>
                            {memberOptions}
                          </select>
                          <input type="date" className={selectCls} value={tk.due_date ?? ''} onChange={(e) => update('tasks', tk.uid, { due_date: e.target.value || null })} />
                          <select className={selectCls} value={tk.status} onChange={(e) => update('tasks', tk.uid, { status: e.target.value })}>
                            {STATUS_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                        </div>
                        {tk.owner_unmatched && (
                          <p className="text-xs text-amber-600 mt-1">訊息提到的負責人「{tk.owner_unmatched}」不是成員，暫時指派給 {memberName(tk.owner_id)}。</p>
                        )}
                        {Number.isInteger(tk.doc)
                          ? <DocSource doc={docs[tk.doc]} excerpt={tk.excerpt} />
                          : <SourceMessages indexes={tk.messages} byIndex={byIndex} />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {(source !== 'document' || items.photos.length > 0) && <Section title="照片" count={`${chosen.photos.length}/${items.photos.length}`}
              action={items.photos.length > 0 && <button onClick={() => setAll('photos', chosen.photos.length !== items.photos.length)} className="text-xs text-blue-600">{chosen.photos.length === items.photos.length ? '全部取消' : '全選'}</button>}>
              {items.photos.length === 0 && <p className="text-sm text-gray-400">沒有照片。</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {items.photos.map((p) => {
                  const m = byIndex.get(p.message)
                  return (
                    <div key={p.uid} className={`bg-white border rounded-lg p-3 flex gap-3 ${p.checked ? 'border-gray-200' : 'border-gray-100 opacity-50'}`}>
                      <input type="checkbox" className="w-4 h-4 mt-1 accent-blue-600 shrink-0" checked={p.checked} onChange={(e) => update('photos', p.uid, { checked: e.target.checked })} />
                      {thumbs[p.message]
                        ? <img src={thumbs[p.message]} alt="" className="w-20 h-20 object-cover rounded shrink-0 bg-gray-100" />
                        : <div className="w-20 h-20 rounded bg-gray-100 shrink-0 flex items-center justify-center text-xs text-gray-400">無預覽</div>}
                      <div className="flex-1 min-w-0 flex flex-col gap-2">
                        {activitySelect(p.activity_id, (v) => update('photos', p.uid, { activity_id: v }))}
                        <input className={inputCls} value={p.caption} placeholder="說明（選填）" onChange={(e) => update('photos', p.uid, { caption: e.target.value })} />
                        <p className="text-xs text-gray-400 truncate">{m?.sender} · {fmtAt(m?.at)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Section>}

            <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 px-4 py-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
              <div className="max-w-3xl mx-auto flex flex-wrap items-center gap-3">
                <p className="text-xs text-gray-500 flex-1 min-w-[12rem]">
                  {tasksMissingActivity > 0
                    ? <span className="text-red-600">有 {tasksMissingActivity} 個任務還沒選擇活動項目。</span>
                    : source === 'document'
                      ? `將儲存 ${chosenDocs.length} 份文件、${chosenNewKeys.size} 個新活動項目、${chosen.status_updates.length} 則狀態更新、${chosen.tasks.length} 個任務。`
                      : `將儲存 ${chosen.status_updates.length} 則狀態更新、${chosen.tasks.length} 個任務、${chosen.photos.length} 張照片。全部 ${inRange.length} 則訊息會標記為已匯入。`}
                </p>
                <button onClick={() => (source === 'document' ? reset() : setStep('match'))} className="px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">上一步</button>
                <button onClick={confirmImport} disabled={tasksMissingActivity > 0 || nothingChosen}
                  className="px-4 py-2 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
                  確認匯入
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'done' && result && (
          <div className="max-w-md bg-white border border-gray-200 rounded-xl p-6">
            <p className="text-base font-semibold text-gray-900 mb-2">匯入完成</p>
            <p className="text-sm text-gray-700">
              已儲存
              {result.saved.documents > 0 && ` ${result.saved.documents} 份文件、`}
              {result.saved.activities > 0 && ` ${result.saved.activities} 個新活動項目、`}
              {' '}{result.saved.status_updates} 則狀態更新、{result.saved.tasks} 個任務
              {result.saved.photos > 0 && `、${result.saved.photos} 張照片`}。
              {result.messages > 0 && ` ${result.messages} 則訊息已標記為已匯入，下次會自動略過。`}
            </p>
            {result.failedPhotos?.length > 0 && (
              <p className="text-sm text-amber-700 mt-2">有 {result.failedPhotos.length} 張照片無法讀取（可能是 HEIC 格式），沒有上傳。</p>
            )}
            <div className="flex gap-3 mt-5">
              <Link href={`/${slug}/activities`} className="px-4 py-2 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-700">查看活動</Link>
              <Link href={`/${slug}/tasks`} className="px-4 py-2 rounded-lg text-sm text-gray-700 border border-gray-200 hover:bg-gray-50">查看任務</Link>
              <button onClick={reset} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">再匯入</button>
            </div>
          </div>
        )}
      </Layout>
    </LangProvider>
  )
}
