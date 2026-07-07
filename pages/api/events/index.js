import { query } from '@/lib/db'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { rows, } = await query(
      'SELECT * FROM events ORDER BY event_date DESC'
    )
    return res.status(200).json(rows)
  }

  if (req.method === 'POST') {
    const { name, slug, event_date, status } = req.body
    const { rows: [data] } = await query(
      `INSERT INTO events (name, slug, event_date, status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, slug, event_date, status ?? 'active']
    )
    return res.status(201).json(data)
  }

  res.setHeader('Allow', ['GET', 'POST'])
  res.status(405).end()
}
