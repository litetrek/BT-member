import { query } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const DEFAULT_NAMES = ['一般', '採購', '聯絡溝通', '現場工作']

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  if (session.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' })

  const { id } = req.query

  if (req.method === 'DELETE') {
    const { rows: [existing] } = await query(
      'SELECT name FROM task_types WHERE id = $1',
      [id]
    )
    if (!existing) return res.status(404).json({ error: '找不到此類型' })
    if (DEFAULT_NAMES.includes(existing.name)) {
      return res.status(400).json({ error: '無法刪除預設類型' })
    }

    await query('DELETE FROM task_types WHERE id = $1', [id])
    return res.status(204).end()
  }

  res.setHeader('Allow', ['DELETE'])
  res.status(405).end()
}
