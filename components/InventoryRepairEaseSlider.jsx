import { REPAIR_EASE_LEVELS, normalizeRepairEase } from '@/lib/inventoryConstants'

// 維修容易程度 Repair ease (0–5), shown under the damage sliders in every lantern form:
// field-mode New, New/Edit and Quick Inspect. value null = 未評估 (not rated) — the slider
// only sets a number once it's moved, and 清除 puts it back to 未評估.
export default function InventoryRepairEaseSlider({ value, onChange, compact = false }) {
  const v = normalizeRepairEase(value)
  const rated = v !== null && v !== undefined
  const level = rated ? REPAIR_EASE_LEVELS[v] : null

  return (
    <div>
      <div className="flex justify-between items-baseline gap-2 text-sm text-gray-500 mb-1">
        <label htmlFor="repair-ease">維修容易程度 Repair ease</label>
        <span className={rated ? 'font-medium text-gray-700 text-right' : 'text-gray-400 text-right'}>
          {rated ? `${v} · ${level.zh}` : '未評估 — 拖動評分'}
          {rated && (
            <button type="button" onClick={() => onChange(null)} className="ml-2 text-xs text-gray-400 hover:text-blue-600 underline">
              清除
            </button>
          )}
        </span>
      </div>
      <input
        id="repair-ease"
        type="range" min="0" max="5" step="1"
        value={rated ? v : 0}
        onChange={(e) => onChange(Number(e.target.value))}
        onClick={(e) => { if (!rated) onChange(Number(e.currentTarget.value)) }}
        aria-valuetext={rated ? `${v} ${level.zh}` : '未評估'}
        className={`w-full ${rated ? '' : 'opacity-40'}`}
      />
      <div className="flex justify-between text-xs text-gray-400 mt-0.5 select-none">
        {REPAIR_EASE_LEVELS.map((l) => <span key={l.value} className="w-4 text-center">{l.value}</span>)}
      </div>
      {!compact && (
        <div className="flex justify-between text-xs text-gray-400">
          <span>0 不需修補</span><span>5 需大幅修補</span>
        </div>
      )}
    </div>
  )
}
