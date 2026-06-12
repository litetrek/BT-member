import { useState } from 'react'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import Avatar from './Avatar'

// Inline SVG icons — no CDN dependency, always visible on mobile
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
    users: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`w-5 h-5 ${className}`}>
        <circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.85"/>
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
  const [menuOpen, setMenuOpen] = useState(false)

  const nav = [
    { key: 'dashboard',  label: 'Dashboard',  labelZh: '總覽',  icon: 'dashboard',  href: `/${slug}/dashboard` },
    { key: 'activities', label: 'Activities',  labelZh: '活動',  icon: 'activities', href: `/${slug}/activities` },
    { key: 'tasks',      label: 'Tasks',       labelZh: '任務',  icon: 'tasks',      href: `/${slug}/tasks` },
    ...(userRole === 'admin'
      ? [{ key: 'users', label: 'Users', labelZh: '成員', icon: 'users', href: `/${slug}/admin/users` }]
      : []),
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Top header ── */}
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          {/* Site slug — always visible */}
          <span className="text-sm font-semibold text-gray-800 truncate">{slug}</span>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-1 ml-2">
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
                {item.labelZh}
              </Link>
            ))}
          </nav>
        </div>

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
                <div className="absolute right-0 mt-2 w-44 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1">
                  <div className="px-4 py-2 border-b border-gray-100 sm:hidden">
                    <p className="text-xs font-medium text-gray-800 truncate">{user.name}</p>
                    <p className="text-xs text-gray-400 truncate">{userRole}</p>
                  </div>
                  <button
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Icon name="logout" className="text-gray-400" />
                    登出
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </header>

      {/* ── Main content — bottom padding on mobile for tab bar ── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 sm:pb-8">
        {children}
      </main>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-30 flex">
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
              <span className="text-[10px] font-medium">{item.labelZh}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
