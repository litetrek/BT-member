import { useState, useRef, useEffect } from 'react'
import { useLang } from '@/context/LangContext'
import { t } from '@/lib/lang'

function MicIcon({ recording, className = '' }) {
  if (recording) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`w-4 h-4 ${className}`}>
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
        <line x1="8" y1="23" x2="16" y2="23"/>
      </svg>
    )
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`w-4 h-4 ${className}`}>
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  )
}

export default function AIChat({ eventId }) {
  const lang = useLang()
  const [messages, setMessages] = useState([])
  const [history,  setHistory]  = useState([])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [recording, setRecording] = useState(false)
  const [hasSpeech, setHasSpeech] = useState(false)
  const bottomRef = useRef(null)
  const recognitionRef = useRef(null)

  useEffect(() => {
    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
    setHasSpeech(!!SR)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function startRecording() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.lang = lang === 'en' ? 'en-US' : 'zh-TW'
    rec.continuous = false
    rec.interimResults = false

    rec.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript ?? ''
      if (transcript) {
        setInput((prev) => (prev ? prev + ' ' + transcript : transcript))
      }
    }
    rec.onend = () => { setRecording(false) }
    rec.onerror = () => { setRecording(false) }

    recognitionRef.current = rec
    rec.start()
    setRecording(true)
  }

  function stopRecording() {
    recognitionRef.current?.stop()
    setRecording(false)
  }

  function toggleMic() {
    if (recording) { stopRecording() } else { startRecording() }
  }

  const errMsg = t(lang,
    'Sorry, unable to get a response. Please try again.',
    '抱歉，無法取得回應，請再試一次。'
  )

  async function send() {
    const q = input.trim()
    if (!q || loading) return
    setInput('')

    const userMsg  = { role: 'user',      content: q,    ts: Date.now() }
    const pending  = { role: 'assistant', content: null, ts: Date.now() + 1 }
    setMessages((m) => [...m, userMsg, pending])
    setLoading(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ event_id: eventId, question: q, conversation_history: history }),
      })
      const data = await res.json()
      const answer = res.ok ? (data.answer ?? errMsg) : errMsg
      if (res.ok && data.updated_history) setHistory(data.updated_history)
      setMessages((m) => m.map((msg) => msg === pending ? { ...msg, content: answer } : msg))
    } catch {
      setMessages((m) => m.map((msg) => msg === pending ? { ...msg, content: errMsg } : msg))
    }
    setLoading(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  function clearChat() {
    setMessages([])
    setHistory([])
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="ti ti-message-chatbot text-blue-500 text-lg" />
          <span className="text-sm font-medium text-gray-800">{t(lang, 'AI Q&A Assistant', 'AI 問答助理')}</span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            {t(lang, 'Clear Chat', '清除對話')}
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="px-4 py-3 flex flex-col gap-3 min-h-[120px] max-h-80 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-xs text-gray-400 text-center mt-4">
            {t(lang,
              'Ask a question, e.g. "Which tasks are overdue?"',
              '請輸入問題，例如：「有哪些任務逾期？」'
            )}
          </p>
        )}
        {messages.map((msg, i) => {
          const isUser = msg.role === 'user'
          return (
            <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                  isUser
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                }`}
              >
                {msg.content === null ? (
                  <span className="text-gray-400 italic">{t(lang, 'Thinking…', '思考中…')}</span>
                ) : msg.content}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input row */}
      <div className="px-4 pb-4 pt-2 border-t border-gray-100 flex gap-2 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={t(lang, 'Enter question… (Enter to send)', '輸入問題… (Enter 送出)')}
          disabled={loading}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none disabled:opacity-50"
        />

        {hasSpeech && (
          <button
            type="button"
            onClick={toggleMic}
            title={t(lang, 'Voice Input', '語音輸入')}
            className={`p-2 rounded-lg border transition-colors shrink-0 ${
              recording
                ? 'border-red-400 bg-red-50 text-red-500 animate-pulse'
                : 'border-gray-200 text-gray-400 hover:text-blue-500 hover:border-blue-300'
            }`}
          >
            <MicIcon recording={recording} />
          </button>
        )}

        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 shrink-0"
        >
          {t(lang, 'Send', '送出')}
        </button>
      </div>
    </div>
  )
}
