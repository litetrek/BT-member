import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { getInventoryRole } from '@/lib/inventory'
import InventoryLanternForm from '@/components/InventoryLanternForm'

export default function NewLantern() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const role = getInventoryRole(session?.user?.email)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/inventory')
    if (status === 'authenticated' && (!role || role === 'viewer')) router.replace('/inventory/lanterns')
  }, [status, role])

  if (status !== 'authenticated' || !role || role === 'viewer') return null

  return (
    <>
      <Head><title>新增燈籠 · 燈籠庫存</title></Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center gap-3">
            <Link href="/inventory/lanterns" className="text-gray-400 hover:text-gray-700 text-sm">← 燈籠列表</Link>
            <div>
              <h1 className="font-semibold text-gray-900">新增燈籠</h1>
              <p className="text-xs text-gray-500">New Lantern</p>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-8">
          <InventoryLanternForm onCancel={() => router.push('/inventory/lanterns')} />
        </main>
      </div>
    </>
  )
}
