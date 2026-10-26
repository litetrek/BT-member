import Link from 'next/link'
import { useRouter } from 'next/router'

const TABS = [
  { key: 'list', name: '燈籠列表', nameEn: 'Lanterns', href: '/inventory/lanterns', ready: true },
  { key: 'locations', name: '地點', nameEn: 'Locations', href: '/inventory/lanterns/locations', ready: true },
  { key: 'field', name: '現場模式', nameEn: 'Field', href: '/inventory/lanterns/field', ready: true },
  { key: 'admin', name: '管理', nameEn: 'Admin', ready: false },
]

export default function InventoryLanternNav({ active }) {
  const router = useRouter()
  return (
    <nav className="bg-white border-b border-gray-100 px-6">
      <div className="max-w-6xl mx-auto flex gap-1">
        {TABS.map((t) => {
          const isActive = t.key === active
          const cls = `px-3 py-2 text-base border-b-2 transition-colors ${
            isActive
              ? 'border-blue-600 text-blue-700 font-medium'
              : t.ready
              ? 'border-transparent text-gray-500 hover:text-gray-900'
              : 'border-transparent text-gray-300 cursor-not-allowed'
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
