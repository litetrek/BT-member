import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// GET /api/event-documents?event_id= → imported documents (without their full text).
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).end()
  }
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const { event_id } = req.query
  if (!event_id) return res.status(400).json({ error: 'event_id is required' })
  try {
    const { rows } = await query(
      `SELECT d.id, d.activity_id, d.name, d.url, d.mime, d.size_bytes, d.doc_kind, d.summary, d.created_at,
              u.name AS uploader_name
       FROM event_documents d LEFT JOIN users u ON u.id = d.uploaded_by
       WHERE d.event_id = $1 ORDER BY d.created_at DESC`,
      [event_id]
    )
    return res.status(200).json(rows)
  } catch (err) {
    if (err.code === '42P01') return res.status(200).json([]) // created on the first import
    throw err
  }
}
