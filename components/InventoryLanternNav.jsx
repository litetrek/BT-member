import Link from 'next/link'
import { useRouter } from 'next/router'

const TABS = [
  { key: 'list', name: '燈籠列表', nameEn: 'Lanterns', href: '/inventory/lanterns', ready: true },
  { key: 'locations', name: '地點', nameEn: 'Locations', href: '/inventory/lanterns/locations', ready: true },
  { key: 'field', name: '現場模式', nameEn: 'Field', href: '/inventory/lanterns/field', ready: true },
  { key: 'dashboard', name: '儀表板', nameEn: 'Dashboard', href: '/inventory/lanterns/dashboard', ready: true },
  { key: 'labels', name: '標籤', nameEn: 'Labels', href: '/inventory/lanterns/labels', ready: true },
  { key: 'admin', name: '管理', nameEn: 'Admin', href: '/inventory/lanterns/admin', ready: true },
]

export default function InventoryLanternNav({ active }) {
  const router = useRouter()
  return (
    <nav className="bg-white border-b border-gray-200 px-4 sm:px-6 print:hidden">
      <div className="max-w-6xl mx-auto flex gap-1 overflow-x-auto">
        {TABS.map((t) => {
          const isActive = t.key === active
          const cls = `shrink-0 px-4 py-3 text-base font-medium rounded-t-lg transition-colors ${
            isActive
              ? 'bg-blue-50 text-blue-700'
              : t.ready
              ? 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              : 'text-gray-300 cursor-not-allowed'
          }`
          return t.ready ? (
            <Link key={t.key} href={t.href} className={cls}>{t.name}</Link>
          ) : (
            <span key={t.key} className={cls} title="即將推出">{t.name}</span>
          )
        })}
      </div>
    </nav>
  )
}
