import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { signOut } from 'next-auth/react'
import Avatar from './Avatar'

export default function Layout({ children, slug, activePage, user, userRole }) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  const nav = [
    { key: 'dashboard',  label: 'Dashboard',  href: `/${slug}/dashboard` },
    { key: 'activities', label: 'Activities',  href: `/${slug}/activities` },
    { key: 'tasks',      label: 'Tasks',       href: `/${slug}/tasks` },
    ...(userRole === 'admin'
      ? [{ key: 'users', label: 'Users', href: `/${slug}/admin/users` }]
      : []),
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-gray-400 hover:text-gray-700">
            <span className="ti ti-grid-dots text-xl" />
          </Link>
          <span className="text-sm font-medium text-gray-700 hidden sm:block">
            {slug}
          </span>
          <nav className="flex items-center gap-1 ml-4">
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
        </div>

        {user && (
          <div className="relative">
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
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                />
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

      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  )
}
