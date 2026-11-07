// Row of big tap buttons for a short list of choices (底座 Base, 尺寸 Size, …), used in
// field-mode New, New/Edit and Quick Inspect. Tapping the selected one again clears it (未填).
// options: [{ value, zh, en }] — value is what's stored; zh/en are shown.
export default function InventoryOptionPicker({
  label, options, value, onChange, cols = 2, labelCls = 'block text-sm text-gray-500 mb-1',
}) {
  const gridCols = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' }[cols] ?? 'grid-cols-2'
  return (
    <div>
      <p className={labelCls}>
        {label} {value ? '' : <span className="text-gray-400">（未填）</span>}
      </p>
      <div className={`grid ${gridCols} gap-2`} role="radiogroup" aria-label={label}>
        {options.map((o) => {
          const on = value === o.value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(on ? null : o.value)}
              className={`py-2.5 px-1 rounded-lg border-2 text-sm leading-tight transition-colors ${
                on ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'
              }`}
            >
              <span className="block font-medium text-base">{o.zh}</span>
              <span className="block text-xs">{o.en}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
