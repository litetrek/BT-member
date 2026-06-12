import { useState, useRef, useEffect } from 'react'

export default function AIChat({ eventId }) {
  const [messages, setMessages] = useState([])
  const [history,  setHistory]  = useState([])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    const q = input.trim()
    if (!q || loading) return
    setInput('')

    // Append user message + pending assistant bubble
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
      const answer = res.ok ? (data.answer ?? '抱歉，無法取得回應，請再試一次。') : '抱歉，無法取得回應，請再試一次。'
      if (res.ok && data.updated_history) setHistory(data.updated_history)

      // Replace pending bubble with real answer
      setMessages((m) => m.map((msg) => msg === pending ? { ...msg, content: answer } : msg))
    } catch {
      setMessages((m) => m.map((msg) => msg === pending ? { ...msg, content: '抱歉，無法取得回應，請再試一次。' } : msg))
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
          <span className="text-sm font-medium text-gray-800">AI 問答助理</span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            清除對話
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="px-4 py-3 flex flex-col gap-3 min-h-[120px] max-h-80 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-xs text-gray-400 text-center mt-4">請輸入問題，例如：「有哪些任務逾期？」</p>
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
                  <span className="text-gray-400 italic">思考中…</span>
                ) : msg.content}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-4 sm:pb-4 pt-2 border-t border-gray-100 flex gap-2 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="輸入問題… (Enter 送出)"
          disabled={loading}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 shrink-0"
        >
          送出
        </button>
      </div>
    </div>
  )
}
