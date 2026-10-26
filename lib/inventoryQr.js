import QRCode from 'qrcode'

// Encodes the lantern's full detail URL, not just the tag ID — per the spec, a plain
// camera scan (no app involved) should open the record directly in Safari.
export function lanternQrUrl(tagId) {
  return `${window.location.origin}/inventory/lanterns/${tagId}`
}

export async function generateQrDataUrl(text) {
  return QRCode.toDataURL(text, { margin: 1, width: 256 })
}
