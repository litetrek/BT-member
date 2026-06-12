import { useState } from 'react'

const RANGES = [
  { value: '4',   label: 'Last 4 hours' },
  { value: '24',  label: 'Last 24 hours' },
  { value: '168', label: 'Last 7 days' },
]

export default function AISummary({ eventId }) {
  const [hours, setHours]       = useState('24')
  const [summary, setSummary]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [count, setCount]       = useState(null)

  async function generate() {
    setLoading(true)
    setSummary('')
    setError('')
    setCount(null)

    const res = await fetch(`/api/ai/summary?event_id=${eventId}&hours=${hours}`)
    const d = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(d.error ?? 'Failed to generate summary')
    } else {
      setSummary(d.summary ?? '')
      setCount(d.entry_count ?? null)
    }
    setLoading(false)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="ti ti-brain text-purple-500" />
          <h3 className="text-sm font-medium text-gray-800">AI Activity Summary</h3>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className="border border-gray-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-purple-400"
          >
            {RANGES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <button
            onClick={generate}
            disabled={loading}
            className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1"
          >
            {loading ? (
              <>
                <span className="ti ti-loader-2 animate-spin text-xs" />
                <span>Thinking…</span>
              </>
            ) : 'Generate'}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      {summary && !loading && (
        <div>
          <p className="text-sm text-gray-700 leading-relaxed">{summary}</p>
          {count !== null && (
            <p className="text-xs text-gray-400 mt-2">{count} event{count !== 1 ? 's' : ''} analyzed</p>
          )}
        </div>
      )}

      {!summary && !loading && !error && (
        <p className="text-xs text-gray-400">Select a time range and click Generate to summarize recent activity.</p>
      )}
    </div>
  )
}
