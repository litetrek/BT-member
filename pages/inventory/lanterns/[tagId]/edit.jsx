import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { getInventoryRole } from '@/lib/inventory'
import InventoryLanternForm from '@/components/InventoryLanternForm'
import InventoryHeader from '@/components/InventoryHeader'
import Spinner from '@/components/Spinner'

export default function EditLantern() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { tagId } = router.query
  const role = getInventoryRole(session)

  const [lantern, setLantern] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/inventory')
    if (status === 'authenticated' && (!role || role === 'viewer')) router.replace('/inventory/lanterns')
  }, [status, role])

  useEffect(() => {
    if (status !== 'authenticated' || !role || role === 'viewer' || !tagId) return
    setLoading(true)
    fetch(`/api/inventory/lanterns/${tagId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setLantern(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [status, role, tagId])

  if (status !== 'authenticated' || !role || role === 'viewer') return null

  return (
    <>
      <Head><title>編輯 {tagId} · 燈籠庫存</title></Head>
      <div className="min-h-screen bg-gray-50">
        <InventoryHeader icon="lantern" backHref={`/inventory/lanterns/${tagId}`} backLabel={tagId} title="編輯燈籠" subtitle="Edit Lantern" />

        <main className="max-w-6xl mx-auto px-6 py-8">
          {loading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : lantern ? (
            <InventoryLanternForm lantern={lantern} onCancel={() => router.push(`/inventory/lanterns/${tagId}`)} />
          ) : (
            <p className="text-base text-gray-400">找不到此燈籠。</p>
          )}
        </main>
      </div>
    </>
  )
}
