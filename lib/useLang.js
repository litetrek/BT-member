import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

// Returns [lang, updateLang]. Initializes from session; persists to DB on change.
export function useLang() {
  const { data: session } = useSession()
  const [lang, setLang] = useState('zh')

  useEffect(() => {
    if (session?.user?.lang) setLang(session.user.lang)
  }, [session?.user?.lang])

  async function updateLang(newLang) {
    setLang(newLang)
    try {
      await fetch('/api/users/me/lang', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang: newLang }),
      })
    } catch {}
  }

  return [lang, updateLang]
}
