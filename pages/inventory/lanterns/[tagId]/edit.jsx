import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { getInventoryRole } from '@/lib/inventory'
import InventoryLanternForm from '@/components/InventoryLanternForm'
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
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center gap-3">
            <Link href={`/inventory/lanterns/${tagId}`} className="text-gray-400 hover:text-gray-700 text-base">← {tagId}</Link>
            <div>
              <h1 className="font-semibold text-gray-900">編輯燈籠</h1>
              <p className="text-sm text-gray-500">Edit Lantern</p>
            </div>
          </div>
        </header>

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
