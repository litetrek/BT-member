import { BASE_TYPE_OPTIONS } from '@/lib/inventoryConstants'

// 底座 Base — two big tap targets (底盤式 / 插槽式), used in field-mode New and New/Edit.
// Tapping the selected one again clears it (未填).
export default function InventoryBaseTypePicker({ value, onChange, labelCls = 'block text-sm text-gray-500 mb-1' }) {
  return (
    <div>
      <p className={labelCls}>
        底座 Base {value ? '' : <span className="text-gray-400">（未填）</span>}
      </p>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="底座 Base">
        {BASE_TYPE_OPTIONS.map((o) => {
          const on = value === o.value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(on ? null : o.value)}
              className={`py-2.5 px-2 rounded-lg border-2 text-sm leading-tight transition-colors ${
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
