import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { getInventoryRole } from '@/lib/inventory'
import { DISPLAY_DECISION_OPTIONS } from '@/lib/inventoryConstants'
import InventoryLanternNav from '@/components/InventoryLanternNav'
import Spinner from '@/components/Spinner'

const SHORTLIST_CONDITIONS = ['Good', 'OK']
// 'none' = no decision set yet. Defaults to everything checked so a freshly displayable
// lantern (which starts with no decision) shows up here to be decided on, not just the
// ones someone already marked Selected/Candidate.
const SHORTLIST_DECISIONS = [...DISPLAY_DECISION_OPTIONS, 'none']
const DECISION_LABELS = { Candidate: 'Candidate', Selected: 'Selected', 'Needs repair': 'Needs repair', 'Not this year': 'Not this year', none: '未決定 Undecided' }

function StatCard({ label, value }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  )
}

export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const role = getInventoryRole(session?.user?.email)

  const [stats, setStats] = useState(null)
  const [loadingStats, setLoadingStats] = useState(true)

  const [conditions, setConditions] = useState(SHORTLIST_CONDITIONS)
  const [decisions, setDecisions] = useState(SHORTLIST_DECISIONS)
  const [shortlist, setShortlist] = useState([])
  const [loadingShortlist, setLoadingShortlist] = useState(true)
  const [savingId, setSavingId] = useState(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/inventory')
    if (status === 'authenticated' && !role) router.replace('/')
  }, [status, role])

  useEffect(() => {
    if (status !== 'authenticated' || !role) return
    fetch('/api/inventory/dashboard')
      .then((r) => r.json())
      .then((d) => { setStats(d); setLoadingStats(false) })
      .catch(() => setLoadingStats(false))
  }, [status, role])

  function shortlistQuery() {
    const params = new URLSearchParams({ displayable: 'true' })
    // Unchecking every condition/decision box means "show nothing", not "no filter" —
    // send a value that can never match rather than omitting the param.
    params.set('condition', conditions.length ? conditions.join(',') : '__none_selected__')
    params.set('display_decision', decisions.length ? decisions.join(',') : '__none_selected__')
    return params.toString()
  }

  function loadShortlist() {
    setLoadingShortlist(true)
    fetch(`/api/inventory/lanterns?${shortlistQuery()}`)
      .then((r) => r.json())
      .then((d) => { setShortlist(Array.isArray(d) ? d : []); setLoadingShortlist(false) })
      .catch(() => setLoadingShortlist(false))
  }

  useEffect(() => {
    if (status === 'authenticated' && role) loadShortlist()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, role, conditions, decisions])

  function toggle(list, setList, value) {
    setList((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]))
  }

  async function handleDecisionChange(tagId, value) {
    setSavingId(tagId)
    await fetch(`/api/inventory/lanterns/${tagId}/display-decision`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_decision: value || null }),
    })
    setSavingId(null)
    loadShortlist()
  }

  if (status !== 'authenticated' || !role) return null

  return (
    <>
      <Head><title>儀表板 · 燈籠庫存</title></Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center gap-3">
            <Link href="/inventory/lanterns" className="text-gray-400 hover:text-gray-700 text-base">← 燈籠列表</Link>
            <div>
              <h1 className="font-semibold text-gray-900">儀表板</h1>
              <p className="text-sm text-gray-500">Dashboard</p>
            </div>
          </div>
        </header>

        <InventoryLanternNav active="dashboard" />

        <main className="max-w-6xl mx-auto px-6 py-8 space-y-10">
          {loadingStats ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : stats ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="總記錄 Records" value={stats.totalRecords} />
                <StatCard label="總數量 Total QTY" value={stats.totalQty} />
                {stats.byCondition.map((c) => (
                  <StatCard key={c.condition} label={c.condition} value={c.count} />
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg border border-gray-200 p-5">
                  <h2 className="text-base font-semibold text-gray-700 mb-3">按類別 By Category</h2>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-400">
                        <th className="font-normal pb-2">類別</th>
                        <th className="font-normal pb-2 text-right">數量</th>
                        <th className="font-normal pb-2 text-right">平均布面損壞</th>
                        <th className="font-normal pb-2 text-right">平均骨架損壞</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.byCategory.map((c) => (
                        <tr key={c.id} className="border-t border-gray-100">
                          <td className="py-1.5 text-gray-900">{c.name_zh}</td>
                          <td className="py-1.5 text-right text-gray-600">{c.count}</td>
                          <td className="py-1.5 text-right text-gray-600">{c.count > 0 ? `${c.avg_cloth_damage_pct}%` : '—'}</td>
                          <td className="py-1.5 text-right text-gray-600">{c.count > 0 ? `${c.avg_frame_damage_pct}%` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-5">
                  <h2 className="text-base font-semibold text-gray-700 mb-3">按電壓 By Voltage</h2>
                  <table className="w-full text-sm mb-6">
                    <tbody>
                      {stats.byVoltage.map((v) => (
                        <tr key={v.voltage} className="border-t border-gray-100">
                          <td className="py-1.5 text-gray-900">{v.voltage}</td>
                          <td className="py-1.5 text-right text-gray-600">{v.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <h2 className="text-base font-semibold text-gray-700 mb-3">按地點 By Location</h2>
                  <div className="max-h-48 overflow-y-auto">
                    <table className="w-full text-sm">
                      <tbody>
                        {stats.byLocation.map((l) => (
                          <tr key={l.code} className="border-t border-gray-100">
                            <td className="py-1.5 text-gray-900">{l.code}</td>
                            <td className="py-1.5 text-right text-gray-600">{l.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          ) : null}

          <div>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 className="text-lg font-semibold text-gray-900">展覽候選清單 Fair 2027 Shortlist</h2>
              <a
                href={`/api/inventory/lanterns/export?${shortlistQuery()}`}
                className="text-sm bg-gray-800 text-white px-3 py-1.5 rounded hover:bg-gray-900"
              >
                匯出 CSV
              </a>
            </div>

            <div className="flex flex-wrap gap-4 mb-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-400">狀況</span>
                {['Good', 'OK', 'Fair', 'Bad'].map((c) => (
                  <label key={c} className="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" checked={conditions.includes(c)} onChange={() => toggle(conditions, setConditions, c)} />
                    {c}
                  </label>
                ))}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-gray-400">展示決定</span>
                {SHORTLIST_DECISIONS.map((d) => (
                  <label key={d} className="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" checked={decisions.includes(d)} onChange={() => toggle(decisions, setDecisions, d)} />
                    {DECISION_LABELS[d]}
                  </label>
                ))}
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-4">僅顯示可展示燈籠（布面及骨架損壞低於門檻）Only displayable lanterns shown</p>

            {loadingShortlist ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : shortlist.length === 0 ? (
              <p className="text-base text-gray-400">無符合條件的燈籠。</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {shortlist.map((lt) => (
                  <div key={lt.id} className="bg-white rounded-lg border border-gray-200 p-3">
                    <div className="flex gap-3 items-center mb-2">
                      {lt.primary_photo_thumb_url ? (
                        <img src={lt.primary_photo_thumb_url} alt="" className="w-14 h-14 rounded object-cover shrink-0" />
                      ) : (
                        <div className="w-14 h-14 rounded bg-gray-100 shrink-0 flex items-center justify-center text-gray-300 text-xs">無照片</div>
                      )}
                      <div className="min-w-0">
                        <Link href={`/inventory/lanterns/${lt.tag_id}`} className="font-semibold text-gray-900 text-sm hover:underline truncate block">
                          {lt.tag_id} {lt.name_zh}
                        </Link>
                        <p className="text-sm text-gray-400">{lt.condition} · {lt.location_code ?? '—'}</p>
                      </div>
                    </div>
                    <select
                      value={lt.display_decision ?? ''}
                      disabled={savingId === lt.tag_id}
                      onChange={(e) => handleDecisionChange(lt.tag_id, e.target.value)}
                      className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
                    >
                      <option value="">—</option>
                      {DISPLAY_DECISION_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  )
}
