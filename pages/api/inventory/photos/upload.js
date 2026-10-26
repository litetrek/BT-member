import { requireInventoryRole } from '@/lib/auth'
import { uploadInventoryPhoto } from '@/lib/blob'

// Accepts a raw image body (already resized client-side) and uploads it to Vercel Blob.
// Query params: ownerType ('lantern' | 'location' | 'inspection'), ownerId (uuid), kind ('full' | 'thumb').
// Body parsing is disabled so the request stream is piped straight to Blob storage.
export const config = {
  api: { bodyParser: false },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const role = await requireInventoryRole(req, res, 'editor')
  if (!role) return

  const { ownerType, ownerId, kind } = req.query
  if (!ownerType || !ownerId || !['full', 'thumb'].includes(kind)) {
    return res.status(400).json({ error: 'ownerType, ownerId and kind (full|thumb) are required' })
  }

  const contentType = req.headers['content-type'] || 'image/jpeg'
  const ext = contentType === 'image/png' ? 'png' : 'jpg'
  const pathname = `lanterns/${ownerType}/${ownerId}/${kind}-${Date.now()}.${ext}`

  try {
    const url = await uploadInventoryPhoto(pathname, req, contentType)
    return res.status(200).json({ url })
  } catch (err) {
    console.error('[inventory photo upload]', err.message)
    return res.status(500).json({ error: 'Upload failed' })
  }
}
