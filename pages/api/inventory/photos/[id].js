import { query } from '@/lib/db'
import { requireInventoryRole } from '@/lib/auth'
import { insertLanternEvent } from '@/lib/inventoryEvents'

export default async function handler(req, res) {
  const { id } = req.query

  if (req.method === 'DELETE') {
    const role = await requireInventoryRole(req, res, 'editor')
    if (!role) return

    const { rows: [deleted] } = await query('DELETE FROM inv_lantern_photos WHERE id = $1 RETURNING *', [id])
    if (!deleted) return res.status(404).json({ error: 'Photo not found' })
    if (deleted.owner_type === 'lantern') {
      await insertLanternEvent({
        lantern_id: deleted.owner_id, event_type: 'photo_deleted', actor: req.inventoryEmail,
        changes: { photo: [{ id: deleted.id, thumb_url: deleted.thumb_url, is_primary: deleted.is_primary }, null] },
      })
    }
    return res.status(204).end()
  }

  if (req.method === 'PUT') {
    const role = await requireInventoryRole(req, res, 'editor')
    if (!role) return

    const { rows: [existing] } = await query('SELECT * FROM inv_lantern_photos WHERE id = $1', [id])
    if (!existing) return res.status(404).json({ error: 'Photo not found' })

    await query(
      'UPDATE inv_lantern_photos SET is_primary = false WHERE owner_type = $1 AND owner_id = $2',
      [existing.owner_type, existing.owner_id]
    )
    const { rows: [photo] } = await query(
      'UPDATE inv_lantern_photos SET is_primary = true WHERE id = $1 RETURNING *',
      [id]
    )
    return res.status(200).json(photo)
  }

  res.setHeader('Allow', ['PUT', 'DELETE'])
  res.status(405).end()
}
