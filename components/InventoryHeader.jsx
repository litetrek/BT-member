import Link from 'next/link'

function SectionIcon({ name }) {
  const common = { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', className: 'w-5 h-5' }
  const icons = {
    // Inventory Control hub
    box: (
      <svg {...common}>
        <path d="M21 8 12 3 3 8l9 5 9-5Z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" />
      </svg>
    ),
    // Lantern list / detail / new / edit
    lantern: (
      <svg {...common}>
        <path d="M12 2v2" /><path d="M8 6h8l-1 3H9L8 6Z" /><path d="M9 9h6v9a3 3 0 0 1-6 0V9Z" /><path d="M12 11v5" /><path d="M10 20h4" />
      </svg>
    ),
    // Locations
    pin: (
      <svg {...common}>
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />
      </svg>
    ),
    // Field mode
    compass: (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" /><path d="m16 8-2 6-6 2 2-6 6-2Z" />
      </svg>
    ),
    // Dashboard
    chart: (
      <svg {...common}>
        <path d="M3 3v18h18" /><rect x="7" y="13" width="3" height="5" /><rect x="12" y="9" width="3" height="9" /><rect x="17" y="5" width="3" height="13" />
      </svg>
    ),
    // Labels
    tag: (
      <svg {...common}>
        <path d="M12 2H4a2 2 0 0 0-2 2v8l10.6 10.6a2 2 0 0 0 2.8 0l7.2-7.2a2 2 0 0 0 0-2.8L12 2Z" /><circle cx="7.5" cy="7.5" r="1.5" />
      </svg>
    ),
    // Admin
    settings: (
      <svg {...common}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
      </svg>
    ),
  }
  return icons[name] ?? null
}

// Shared header for the Inventory Control module (hub, Lantern list/detail/new/edit,
// Locations, Field mode, Dashboard, Labels) — was previously ~11 near-identical inline
// blocks per page, bare text with no visual identity between sections.
export default function InventoryHeader({ icon, backHref, backLabel, title, titleMono, subtitle, right, printHidden }) {
  return (
    <header className={`bg-white border-b border-gray-200 px-4 sm:px-6 py-4 ${printHidden ? 'print:hidden' : ''}`}>
      {/* flex-wrap: when the right-side buttons don't fit beside the title (e.g. 記錄檢查 /
          編輯 / 刪除 on a phone) they drop to their own row instead of covering it. */}
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1 basis-60">
          <Link href={backHref} className="flex items-center gap-0.5 text-gray-400 hover:text-gray-700 text-base shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            {backLabel}
          </Link>
          <div className="w-px h-6 bg-gray-200 shrink-0" />
          {icon && (
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <SectionIcon name={icon} />
            </div>
          )}
          <div className="min-w-0">
            <h1 className={`font-semibold text-gray-900 ${titleMono ? 'font-mono' : ''} truncate`}>{title}</h1>
            {subtitle && <p className="text-sm text-gray-500 truncate">{subtitle}</p>}
          </div>
        </div>
        {right && <div className="flex flex-wrap items-center justify-end gap-2 shrink-0 ml-auto">{right}</div>}
      </div>
    </header>
  )
}
