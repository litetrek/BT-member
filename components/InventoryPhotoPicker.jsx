import { useRef } from 'react'

// Two-button photo input: "拍照" opens the camera directly (capture attribute, no
// iOS menu); "相簿" opens the photo picker. Browsers don't let a page remove the
// "Choose File" / Google Drive entries from iOS's picker menu, so the camera button
// is the one path that skips the menu entirely.
export default function InventoryPhotoPicker({ onFiles, multiple = false, disabled = false, compact = false }) {
  const cameraRef = useRef(null)
  const libraryRef = useRef(null)

  function handleChange(e) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length) onFiles(files)
  }

  const btn = compact
    ? 'inline-flex items-center gap-1 text-sm text-blue-600 hover:underline disabled:opacity-50'
    : 'flex-1 flex items-center justify-center gap-2 py-3 text-base border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50'

  return (
    <div className={compact ? 'flex items-center gap-4' : 'flex gap-2'}>
      <button type="button" className={btn} disabled={disabled} onClick={() => cameraRef.current?.click()}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
        拍照 Take Photo
      </button>
      <button type="button" className={btn} disabled={disabled} onClick={() => libraryRef.current?.click()}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
        相簿 Photo Library
      </button>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleChange} className="hidden" />
      <input ref={libraryRef} type="file" accept="image/*" multiple={multiple} onChange={handleChange} className="hidden" />
    </div>
  )
}
