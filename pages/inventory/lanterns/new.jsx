import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { getInventoryRole } from '@/lib/inventory'
import InventoryLanternForm from '@/components/InventoryLanternForm'
import InventoryHeader from '@/components/InventoryHeader'

export default function NewLantern() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const role = getInventoryRole(session)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/inventory')
    if (status === 'authenticated' && (!role || role === 'viewer')) router.replace('/inventory/lanterns')
  }, [status, role])

  if (status !== 'authenticated' || !role || role === 'viewer') return null

  return (
    <>
      <Head><title>新增燈籠 · 燈籠庫存</title></Head>
      <div className="min-h-screen bg-gray-50">
        <InventoryHeader icon="lantern" backHref="/inventory/lanterns" backLabel="燈籠列表" title="新增燈籠" subtitle="New Lantern" />

        <main className="max-w-6xl mx-auto px-6 py-8">
          <InventoryLanternForm onCancel={() => router.push('/inventory/lanterns')} />
        </main>
      </div>
    </>
  )
}
