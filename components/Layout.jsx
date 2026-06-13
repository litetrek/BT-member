import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import Avatar from './Avatar'
import { useLang } from '@/context/LangContext'
import { t } from '@/lib/lang'

function Icon({ name, className = '' }) {
  const icons = {
    dashboard: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`w-5 h-5 ${className}`}>
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
    activities: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`w-5 h-5 ${className}`}>
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
        <rect x="9" y="3" width="6" height="4" rx="1"/>
        <path d="m9 12 2 2 4-4"/>
      </svg>
    ),
    tasks: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`w-5 h-5 ${className}`}>
        <rect x="3" y="5" width="6" height="6" rx="1"/><rect x="3" y="13" width="6" height="6" rx="1"/>
        <line x1="13" y1="8" x2="21" y2="8"/><line x1="13" y1="16" x2="21" y2="16"/>
      </svg>
    ),
    ai: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`w-5 h-5 ${className}`}>
        <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
        <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
      </svg>
    ),
    users: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`w-5 h-5 ${className}`}>
        <circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.85"/>
      </svg>
    ),
    home: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`w-5 h-5 ${className}`}>
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
    logout: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`w-4 h-4 ${className}`}>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
        <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
      </svg>
    ),
    chevron: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`w-3 h-3 ${className}`}>
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    ),
  }
  return icons[name] ?? null
}

export default function Layout({ children, slug, activePage, user, userRole }) {
  const lang = useLang()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  const canSeeAI = ['admin', 'lead'].includes(userRole)

  const nav = [
    { key: 'dashboard',  label: t(lang, 'Overview',    '總覽'),   icon: 'dashboard',  href: `/${slug}/dashboard` },
    { key: 'activities', label: t(lang, 'Activities',  '活動'),   icon: 'activities', href: `/${slug}/activities` },
    { key: 'tasks',      label: t(lang, 'Tasks',       '任務'),   icon: 'tasks',      href: `/${slug}/tasks` },
    ...(canSeeAI
      ? [{ key: 'ai', label: t(lang, 'AI Assistant', 'AI 助理'), icon: 'ai', href: `/${slug}/ai` }]
      : []),
    { key: 'users', label: t(lang, 'Members', '成員'), icon: 'users', href: `/${slug}/admin/users`, adminOnly: true },
  ].filter((item) => !item.adminOnly || userRole === 'admin')

  async function handleLangToggle() {
    const newLang = lang === 'zh' ? 'en' : 'zh'
    if (!user?.id) return
    await fetch(`/api/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferred_lang: newLang }),
    })
    router.reload()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Top header ── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <nav className="flex items-center justify-between px-4 sm:px-6 h-14">

          {/* Left: home icon (desktop) + slug (mobile only) */}
          <div className="flex items-center gap-3 min-w-0 sm:w-10">
            <a
              href="https://bt.cyber-tech.com"
              className="hidden sm:flex items-center text-gray-400 hover:text-gray-700 transition-colors shrink-0"
              title={t(lang, 'Back to Home', '返回首頁')}
            >
              <Icon name="home" />
            </a>
            <span className="text-sm font-semibold text-gray-800 truncate sm:hidden">{slug}</span>
          </div>

          {/* Center: desktop nav links */}
          <div className="hidden sm:flex items-center gap-1">
            {nav.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={`px-3 py-1.5 text-sm rounded transition-colors ${
                  activePage === item.key
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Right: avatar + dropdown */}
          {user && (
            <div className="relative shrink-0">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-full hover:bg-gray-100 p-1 transition-colors"
              >
                <Avatar name={user.name} avatarUrl={user.image} size="sm" />
                <span className="text-sm text-gray-600 hidden sm:block pr-1">{user.name}</span>
                <span className="hidden sm:block"><Icon name="chevron" className="text-gray-400" /></span>
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1">
                    <div className="px-4 py-2 border-b border-gray-100 sm:hidden">
                      <p className="text-xs font-medium text-gray-800 truncate">{user.name}</p>
                      <p className="text-xs text-gray-400 truncate">{userRole}</p>
                    </div>

                    {/* Language toggle */}
                    <button
                      onClick={() => { handleLangToggle(); setMenuOpen(false) }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between"
                    >
                      <span>{t(lang, 'Language', '語言')}</span>
                      <span className="text-xs font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                        {lang === 'zh' ? 'EN' : '中文'}
                      </span>
                    </button>

                    <button
                      onClick={() => signOut({ callbackUrl: '/' })}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Icon name="logout" className="text-gray-400" />
                      {t(lang, 'Sign Out', '登出')}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </nav>
      </header>

      {/* ── Main content ── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 sm:pb-8">
        {children}
      </main>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-30 flex">
        <a
          href="https://bt.cyber-tech.com"
          className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-gray-400 hover:text-gray-700 transition-colors"
        >
          <Icon name="home" className="text-gray-400" />
          <span className="text-[10px] font-medium">{t(lang, 'Home', '首頁')}</span>
        </a>

        {nav.map((item) => {
          const active = activePage === item.key
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                active ? 'text-blue-600' : 'text-gray-400 hover:text-gray-700'
              }`}
            >
              <Icon name={item.icon} className={active ? 'text-blue-600' : 'text-gray-400'} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
