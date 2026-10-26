// Browser-only helpers for the Lantern Inventory photo flow: client-side resize
// (so weak on-site signal only has to push a small JPEG) then upload to Blob storage.

function resizeImage(file, { maxEdge, quality }) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      let { width, height } = img
      const scale = Math.min(1, maxEdge / Math.max(width, height))
      width = Math.round(width * scale)
      height = Math.round(height * scale)

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('resize failed'))),
        'image/jpeg',
        quality
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('image failed to load'))
    }
    img.src = objectUrl
  })
}

// Produces a full-size (~1600px long edge) and thumbnail (~400px) JPEG from one source file.
export async function resizeForUpload(file) {
  const [full, thumb] = await Promise.all([
    resizeImage(file, { maxEdge: 1600, quality: 0.8 }),
    resizeImage(file, { maxEdge: 400, quality: 0.75 }),
  ])
  return { full, thumb }
}

async function uploadOne(blob, ownerType, ownerId, kind) {
  const res = await fetch(
    `/api/inventory/photos/upload?ownerType=${ownerType}&ownerId=${ownerId}&kind=${kind}`,
    { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob }
  )
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Upload failed')
  return (await res.json()).url
}

// Resizes then uploads both sizes; returns { url, thumbUrl }.
export async function uploadInventoryPhoto(file, ownerType, ownerId) {
  const { full, thumb } = await resizeForUpload(file)
  const [url, thumbUrl] = await Promise.all([
    uploadOne(full, ownerType, ownerId, 'full'),
    uploadOne(thumb, ownerType, ownerId, 'thumb'),
  ])
  return { url, thumbUrl }
}
