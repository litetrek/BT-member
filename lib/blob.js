import { put } from '@vercel/blob'

// Uploads one already-resized image buffer to Vercel Blob and returns its public URL.
// pathname should be unique per file, e.g. `lanterns/{lanternId}/{photoId}-full.jpg`.
export async function uploadInventoryPhoto(pathname, body, contentType) {
  const blob = await put(pathname, body, {
    access: 'public',
    contentType,
    addRandomSuffix: true,
  })
  return blob.url
}
