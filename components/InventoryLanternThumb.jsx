// Small square photo for a lantern card. `src` is the lantern's primary thumbnail
// (primary_photo_thumb_url from the API — falls back to its first photo); shows a
// grey 無照片 tile when the lantern has no photo yet.
export default function InventoryLanternThumb({ src, alt = '', size = 'w-14 h-14' }) {
  if (!src) {
    return (
      <div className={`${size} rounded bg-gray-100 shrink-0 flex items-center justify-center text-gray-300 text-xs`}>
        無照片
      </div>
    )
  }
  return <img src={src} alt={alt} loading="lazy" className={`${size} rounded object-cover shrink-0 bg-gray-100`} />
}
