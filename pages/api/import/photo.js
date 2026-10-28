import { put } from '@vercel/blob'
import { importGuard, isUuid } from '@/lib/importApi'

// POST /api/import/photo?event_id=&kind=full|thumb   body: raw JPEG (resized in the browser)
// → { url }. One photo per request keeps each upload under Vercel's 4.5 MB body limit.
export const config = { api: { bodyParser: false } }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).end()
  }
  const { event_id, kind } = req.query
  if (!isUuid(event_id) || !['full', 'thumb'].includes(kind)) {
    return res.status(400).json({ error: 'event_id and kind (full|thumb) are required' })
  }
  const ctx = await importGuard(req, res, event_id)
  if (!ctx) return

  const contentType = req.headers['content-type'] || 'image/jpeg'
  if (!/^image\/(jpeg|png|webp)$/.test(contentType)) {
    return res.status(415).json({ error: 'Only JPEG, PNG or WebP images' })
  }
  const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg'

  try {
    const blob = await put(`events/${event_id}/import/${kind}-${Date.now()}.${ext}`, req, {
      access: 'public',
      contentType,
      addRandomSuffix: true,
    })
    return res.status(200).json({ url: blob.url })
  } catch (err) {
    console.error('[import photo upload]', err.message)
    return res.status(500).json({ error: 'Upload failed' })
  }
}
