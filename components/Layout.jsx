import Link from 'next/link'
import { useRouter } from 'next/router'
import Avatar from './Avatar'

export default function Layout({ children, slug, activePage, user, userRole }) {
  const router = useRouter()

  const nav = [
    { key: 'dashboard',  label: 'Dashboard',  href: `/${slug}/dashboard` },
    { key: 'activities', label: 'Activities',  href: `/${slug}/activities` },
    { key: 'tasks',      label: 'Tasks',       href: `/${slug}/tasks` },
    ...(userRole === 'admin'
      ? [{ key: 'users', label: 'Users', href: `/${slug}/users` }]
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
          <div className="flex items-center gap-2">
            <Avatar name={user.name} avatarUrl={user.image} size="sm" />
            <span className="text-sm text-gray-600 hidden sm:block">{user.name}</span>
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  )
}
