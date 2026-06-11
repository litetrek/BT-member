import { ICONS } from '@/lib/constants'

export default function IconPicker({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
    >
      {ICONS.map((item) => (
        <option key={item.key} value={item.icon}>
          {item.label}
        </option>
      ))}
    </select>
  )
}
