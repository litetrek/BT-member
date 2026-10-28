import { handleUpload } from '@vercel/blob/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// Issues a short-lived token so the browser can upload a document straight to Vercel
// Blob (files up to 25 MB; API routes can only accept 4.5 MB). Coordinators only.
const ALLOWED = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel.sheet.macroEnabled.12',
  'text/csv', 'text/plain', 'text/markdown', 'text/tab-separated-values',
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/octet-stream',
]

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).end()
  }
  try {
    const json = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const session = await getServerSession(req, res, authOptions)
        if (!session || !['admin', 'lead'].includes(session.user?.role)) throw new Error('Forbidden')
        const { event_id } = JSON.parse(clientPayload || '{}')
        const { rows } = await query('SELECT id FROM events WHERE id = $1', [event_id])
        if (!rows.length || !pathname.startsWith(`events/${event_id}/docs/`)) throw new Error('Bad event')
        return {
          allowedContentTypes: ALLOWED,
          maximumSizeInBytes: 25 * 1024 * 1024,
          addRandomSuffix: true,
        }
      },
    })
    return res.status(200).json(json)
  } catch (err) {
    return res.status(err.message === 'Forbidden' ? 403 : 400).json({ error: err.message })
  }
}
