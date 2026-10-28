import { query } from '@/lib/db'
import { requireInventoryRole } from '@/lib/auth'
import { insertLanternEvent } from '@/lib/inventoryEvents'

// Creates a photo metadata row (the binary already lives in Blob storage —
// see pages/api/inventory/photos/upload.js). If is_primary is set, unmarks
// any other primary photo for the same owner first.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end()
  }

  const role = await requireInventoryRole(req, res, 'editor')
  if (!role) return

  const { owner_type, owner_id, url, thumb_url, is_primary } = req.body
  if (!owner_type || !owner_id || !url || !thumb_url) {
    return res.status(400).json({ error: 'owner_type, owner_id, url and thumb_url are required' })
  }

  if (is_primary) {
    await query(
      'UPDATE inv_lantern_photos SET is_primary = false WHERE owner_type = $1 AND owner_id = $2',
      [owner_type, owner_id]
    )
  }

  const { rows: [existingPrimary] } = await query(
    'SELECT id FROM inv_lantern_photos WHERE owner_type = $1 AND owner_id = $2 AND is_primary = true',
    [owner_type, owner_id]
  )

  const { rows: [photo] } = await query(
    `INSERT INTO inv_lantern_photos (owner_type, owner_id, url, thumb_url, is_primary, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [owner_type, owner_id, url, thumb_url, !!is_primary || !existingPrimary, req.inventoryEmail]
  )

  if (owner_type === 'lantern') {
    await insertLanternEvent({
      lantern_id: owner_id, event_type: 'photo_added', actor: req.inventoryEmail,
      changes: { photo: [null, { id: photo.id, thumb_url: photo.thumb_url, is_primary: photo.is_primary }] },
    })
  }

  return res.status(201).json(photo)
}
