import { useState } from 'react'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import Avatar from './Avatar'

export default function Layout({ children, slug, activePage, user, userRole }) {
  const [menuOpen, setMenuOpen]   = useState(false)
  const [mobileNav, setMobileNav] = useState(false)

  const nav = [
    { key: 'dashboard',  label: 'Dashboard',  icon: 'ti-layout-dashboard', href: `/${slug}/dashboard` },
    { key: 'activities', label: 'Activities',  icon: 'ti-list-check',       href: `/${slug}/activities` },
    { key: 'tasks',      label: 'Tasks',       icon: 'ti-checkbox',         href: `/${slug}/tasks` },
    ...(userRole === 'admin'
      ? [{ key: 'users', label: 'Users', icon: 'ti-users', href: `/${slug}/admin/users` }]
      : []),
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <Link href="/" className="text-gray-400 hover:text-gray-700 shrink-0">
            <span className="ti ti-grid-dots text-xl" />
          </Link>
          <span className="text-sm font-medium text-gray-700 hidden sm:block shrink-0">
            {slug}
          </span>

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
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Mobile nav toggle */}
          <button
            className="sm:hidden text-gray-500 hover:text-gray-800 ml-1"
            onClick={() => setMobileNav((o) => !o)}
          >
            <span className={`ti ${mobileNav ? 'ti-x' : 'ti-menu-2'} text-lg`} />
          </button>
        </div>

        {user && (
          <div className="relative shrink-0">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2 rounded hover:bg-gray-100 px-2 py-1 transition-colors"
            >
              <Avatar name={user.name} avatarUrl={user.image} size="sm" />
              <span className="text-sm text-gray-600 hidden sm:block">{user.name}</span>
              <span className="ti ti-chevron-down text-xs text-gray-400" />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                  <button
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <span className="ti ti-logout text-gray-400" />
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </header>

      {/* Mobile nav drawer */}
      {mobileNav && (
        <div className="sm:hidden bg-white border-b border-gray-200 px-4 py-2 flex flex-col gap-1">
          {nav.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              onClick={() => setMobileNav(false)}
              className={`flex items-center gap-2 px-3 py-2 text-sm rounded transition-colors ${
                activePage === item.key
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className={`ti ${item.icon} text-base`} />
              {item.label}
            </Link>
          ))}
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">{children}</main>
    </div>
  )
}
