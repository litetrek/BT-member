import { useState, useRef } from 'react'
import { useLang } from '@/context/LangContext'
import { t } from '@/lib/lang'

export default function AISummary({ eventId }) {
  const lang = useLang()
  const RANGES = [
    { value: '4',   label: t(lang, 'Last 4 hrs',  '最近 4 小時') },
    { value: '24',  label: t(lang, 'Last 24 hrs', '最近 24 小時') },
    { value: '168', label: t(lang, 'Last 7 days', '最近 7 天') },
  ]
  const [hours, setHours]     = useState('24')
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [count, setCount]     = useState(null)
  const [speaking, setSpeaking] = useState(false)
  const utteranceRef = useRef(null)

  async function generate() {
    setLoading(true)
    setSummary('')
    setError('')
    setCount(null)
    stopSpeaking()

    const res = await fetch(`/api/ai/summary?event_id=${eventId}&hours=${hours}`)
    const d = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(d.error ?? t(lang, 'Failed to generate summary', '摘要生成失敗'))
    } else {
      setSummary(d.summary ?? '')
      setCount(d.entry_count ?? null)
    }
    setLoading(false)
  }

  function speak() {
    if (!summary || !window.speechSynthesis) return
    stopSpeaking()

    const utterance = new SpeechSynthesisUtterance(summary)
    utterance.lang = lang === 'en' ? 'en-US' : 'zh-TW'
    utterance.rate = 0.9

    utterance.onstart = () => setSpeaking(true)
    utterance.onend   = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)

    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }

  function stopSpeaking() {
    if (window.speechSynthesis) window.speechSynthesis.cancel()
    setSpeaking(false)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="ti ti-brain text-purple-500" />
          <h3 className="text-sm font-medium text-gray-800">{t(lang, 'AI Activity Summary', 'AI 活動摘要')}</h3>
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
                <span>{t(lang, 'Thinking…', '思考中…')}</span>
              </>
            ) : t(lang, 'Generate', '生成')}
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {summary && !loading && (
        <div>
          <p className="text-sm text-gray-700 leading-relaxed">{summary}</p>
          <div className="flex items-center justify-between mt-3">
            {count !== null && (
              <p className="text-xs text-gray-400">
                {lang === 'en' ? `${count} records analyzed` : `${count} 筆記錄已分析`}
              </p>
            )}
            <button
              onClick={speaking ? stopSpeaking : speak}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition-colors ${
                speaking
                  ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span className={`ti ${speaking ? 'ti-player-stop' : 'ti-volume'} text-xs`} />
              {speaking ? t(lang, 'Stop', '停止') : t(lang, 'Read Aloud', '朗讀')}
            </button>
          </div>
        </div>
      )}

      {!summary && !loading && !error && (
        <p className="text-xs text-gray-400">
          {t(lang,
            'Select a time range and click "Generate" to summarize recent activity.',
            '選擇時間範圍並點擊「生成」以摘要近期活動。'
          )}
        </p>
      )}
    </div>
  )
}
