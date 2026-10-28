import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// GET /api/activity-photos?event_id=[&activity_id=] → photos attached to activities.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).end()
  }
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })

  const { event_id, activity_id } = req.query
  if (!event_id) return res.status(400).json({ error: 'event_id is required' })

  try {
    const params = [event_id]
    let extra = ''
    if (activity_id) { params.push(activity_id); extra = ' AND activity_id = $2' }
    const { rows } = await query(
      `SELECT id, activity_id, url, thumb_url, caption, taken_at, sender_name, source
       FROM activity_photos WHERE event_id = $1${extra}
       ORDER BY taken_at DESC NULLS LAST, created_at DESC`,
      params
    )
    return res.status(200).json(rows)
  } catch (err) {
    if (err.code === '42P01') return res.status(200).json([]) // table not created until the first import
    throw err
  }
}
