import { BASE_TYPE_OPTIONS } from '@/lib/inventoryConstants'
import InventoryOptionPicker from '@/components/InventoryOptionPicker'

// 底座 Base — 底盤式 Metal base frame / 插槽式 Socket mount.
export default function InventoryBaseTypePicker(props) {
  return <InventoryOptionPicker label="底座 Base" options={BASE_TYPE_OPTIONS} cols={2} {...props} />
}
