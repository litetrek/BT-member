import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'

// Live camera QR scanner for Field mode's "scan its tag" lantern-selection path.
// Labels encode the lantern's full detail URL, so a plain camera-app scan already opens
// the record directly in Safari — this component exists so a recorder can scan *without*
// leaving Field mode (straight into Quick Inspect at the current location).
export default function InventoryQrScanner({ onScan, onClose }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let stream
    let rafId
    let stopped = false

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return }
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        tick()
      } catch (err) {
        setError('無法開啟相機 Could not open camera: ' + err.message)
      }
    }

    function tick() {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafId = requestAnimationFrame(tick)
        return
      }
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height)
      if (code?.data) {
        const match = code.data.match(/\/inventory\/lanterns\/([A-Za-z0-9-]+)\/?$/)
        if (match) {
          stopped = true
          onScan(match[1])
          return
        }
      }
      rafId = requestAnimationFrame(tick)
    }

    start()
    return () => {
      stopped = true
      if (rafId) cancelAnimationFrame(rafId)
      stream?.getTracks().forEach((t) => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center">
      <button onClick={onClose} className="absolute top-4 right-4 text-white text-3xl w-11 h-11 flex items-center justify-center">×</button>
      {error ? (
        <p className="text-white text-base px-6 text-center">{error}</p>
      ) : (
        <>
          <video ref={videoRef} playsInline muted className="w-full max-w-md" />
          <p className="text-white text-base mt-4">對準燈籠標籤上的 QR code</p>
        </>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
