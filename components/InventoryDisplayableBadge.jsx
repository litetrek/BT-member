import { useEffect, useRef, useState } from 'react'

// 不可展示 badge with a tap/hover popover listing why (Phase 1.5). A plain `title`
// tooltip never shows on iPhone, so the reasons open on tap as well as on hover.
// Safe inside a <Link> card: taps on the badge don't navigate.
export default function InventoryDisplayableBadge({ reasons, size = 'sm' }) {
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(false)
  const [pos, setPos] = useState(null) // fixed-position coords, clamped to the viewport
  const ref = useRef(null)
  const list = reasons?.length ? reasons : ['布面或骨架損壞達門檻 Damage at or above threshold']
  const visible = open || hover

  // Position with `fixed` so the popover is never clipped by a card or the screen edge
  // (a 256px popover anchored mid-card overflowed a 375px phone).
  useEffect(() => {
    if (!visible || !ref.current) return
    function place() {
      const r = ref.current.getBoundingClientRect()
      const width = Math.min(256, window.innerWidth - 32)
      const left = Math.max(16, Math.min(r.left, window.innerWidth - width - 16))
      setPos({ left, top: r.bottom + 4, width })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => { window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place) }
  }, [visible])

  useEffect(() => {
    if (!open) return
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    function onKey(e) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])

  function toggle(e) {
    e.preventDefault()
    e.stopPropagation()
    setOpen((o) => !o)
  }

  const badgeCls = size === 'lg'
    ? 'text-sm px-2 py-1'
    : 'text-xs px-1.5 py-0.5'

  return (
    <span
      ref={ref}
      className="relative inline-flex"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span
        role="button"
        tabIndex={0}
        aria-expanded={visible}
        aria-label="不可展示 — 顯示原因 Show reason"
        onClick={toggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggle(e) }}
        className={`${badgeCls} text-red-600 bg-red-50 rounded cursor-pointer select-none whitespace-nowrap underline decoration-dotted underline-offset-2`}
      >
        不可展示 ⓘ
      </span>
      {visible && pos && (
        <span
          role="tooltip"
          onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
          style={{ left: pos.left, top: pos.top, width: pos.width }}
          className="fixed z-50 bg-white border border-red-200 shadow-lg rounded-lg p-3 text-left cursor-default"
        >
          <span className="block text-xs font-semibold text-red-700 mb-1">不可展示原因 Why not displayable</span>
          {list.map((r) => (
            <span key={r} className="block text-sm text-gray-700 leading-snug">• {r}</span>
          ))}
        </span>
      )}
    </span>
  )
}
