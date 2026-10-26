import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { getInventoryRole } from '@/lib/inventory'

export default function LanternInventory() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const role = getInventoryRole(session?.user?.email)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/inventory')
    if (status === 'authenticated' && !role) router.replace('/')
  }, [status, role])

  if (status !== 'authenticated' || !role) return null

  return (
    <>
      <Head><title>燈籠庫存 · 庫存管理</title></Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center gap-3">
            <Link href="/inventory" className="text-gray-400 hover:text-gray-700 text-sm">← 庫存管理</Link>
            <div>
              <h1 className="font-semibold text-gray-900">燈籠庫存</h1>
              <p className="text-xs text-gray-500">Lantern Inventory</p>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-10">
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-sm text-gray-400">功能開發中，敬請期待。</p>
          </div>
        </main>
      </div>
    </>
  )
}
