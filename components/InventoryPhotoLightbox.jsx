import { useState } from 'react'

// Full-screen photo viewer. Tap the image to toggle a 200% zoom (scrollable);
// native pinch-zoom also works since we never disable viewport scaling. Tap the
// backdrop or the × to close; prev/next arrows appear when there's more than one photo.
export default function InventoryPhotoLightbox({ urls, initialIndex = 0, onClose }) {
  const [index, setIndex] = useState(initialIndex)
  const [zoomed, setZoomed] = useState(false)

  function prev(e) {
    e.stopPropagation()
    setZoomed(false)
    setIndex((i) => (i - 1 + urls.length) % urls.length)
  }
  function next(e) {
    e.stopPropagation()
    setZoomed(false)
    setIndex((i) => (i + 1) % urls.length)
  }

  return (
    <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center" onClick={onClose}>
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white text-3xl w-11 h-11 flex items-center justify-center hover:bg-white/10 rounded-full"
        aria-label="關閉 Close"
      >
        ×
      </button>

      {urls.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-1 sm:left-4 text-white text-3xl w-11 h-11 flex items-center justify-center hover:bg-white/10 rounded-full"
            aria-label="上一張 Previous"
          >
            ‹
          </button>
          <button
            onClick={next}
            className="absolute right-1 sm:right-4 text-white text-3xl w-11 h-11 flex items-center justify-center hover:bg-white/10 rounded-full"
            aria-label="下一張 Next"
          >
            ›
          </button>
        </>
      )}

      <div
        className={`w-full h-full flex items-center justify-center ${zoomed ? 'overflow-auto p-4' : 'overflow-hidden p-8'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={urls[index]}
          alt=""
          onClick={() => setZoomed((z) => !z)}
          className={zoomed ? 'max-w-none cursor-zoom-out' : 'max-w-full max-h-full object-contain cursor-zoom-in'}
          style={zoomed ? { width: '200%' } : undefined}
        />
      </div>

      {urls.length > 1 && (
        <div className="absolute bottom-4 text-white text-sm">{index + 1} / {urls.length}</div>
      )}
    </div>
  )
}
