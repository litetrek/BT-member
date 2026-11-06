import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { getInventoryRole } from '@/lib/inventory'
import InventoryLanternForm from '@/components/InventoryLanternForm'
import InventoryHeader from '@/components/InventoryHeader'
import Spinner from '@/components/Spinner'

// /inventory/lanterns/new          → blank form
// /inventory/lanterns/new?copy=TAG → 複製: form pre-filled from TAG (photos not copied);
//                                     saving creates a brand-new lantern with its own tag.
export default function NewLantern() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const role = getInventoryRole(session)
  const copyTag = typeof router.query.copy === 'string' ? router.query.copy : null

  const [source, setSource] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/inventory')
    if (status === 'authenticated' && (!role || role === 'viewer')) router.replace('/inventory/lanterns')
  }, [status, role])

  useEffect(() => {
    if (!router.isReady || !copyTag || status !== 'authenticated' || !role || role === 'viewer') return
    setLoading(true)
    setLoadError('')
    fetch(`/api/inventory/lanterns/${encodeURIComponent(copyTag)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setSource(d)
        else setLoadError(`找不到 ${copyTag}，無法複製。`)
      })
      .catch(() => setLoadError(`讀取 ${copyTag} 失敗。`))
      .finally(() => setLoading(false))
  }, [router.isReady, copyTag, status, role])

  if (status !== 'authenticated' || !role || role === 'viewer') return null

  const isCopy = !!copyTag
  const backHref = isCopy ? `/inventory/lanterns/${copyTag}` : '/inventory/lanterns'

  return (
    <>
      <Head><title>{isCopy ? `複製 ${copyTag}` : '新增燈籠'} · 燈籠庫存</title></Head>
      <div className="min-h-screen bg-gray-50">
        <InventoryHeader
          icon="lantern"
          backHref={backHref}
          backLabel={isCopy ? copyTag : '燈籠列表'}
          title={isCopy ? '複製燈籠' : '新增燈籠'}
          subtitle={isCopy ? 'Copy Lantern' : 'New Lantern'}
        />

        <main className="max-w-6xl mx-auto px-6 py-8">
          {!router.isReady || loading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : isCopy && !source ? (
            <p className="text-base text-gray-400">{loadError || '找不到此燈籠。'}</p>
          ) : (
            <>
              {isCopy && (
                <div className="max-w-2xl mb-4 border border-amber-200 bg-amber-50 text-amber-800 rounded-lg px-4 py-3 text-base">
                  從 <span className="font-mono">{source.tag_id}</span> 複製的資料，可以修改任何欄位。照片不會複製。
                  按「儲存」後會新增一筆新的燈籠，並得到新的標籤編號。
                </div>
              )}
              <InventoryLanternForm
                key={source?.id ?? 'blank'}
                initial={source}
                onCancel={() => router.push(backHref)}
              />
            </>
          )}
        </main>
      </div>
    </>
  )
}
