import { SIZE_CLASS_OPTIONS } from '@/lib/inventoryConstants'
import InventoryOptionPicker from '@/components/InventoryOptionPicker'

// 尺寸大小 Size — 小 / 中 / 大 / 超大, shown under 底座.
export default function InventorySizePicker(props) {
  return <InventoryOptionPicker label="尺寸大小 Size" options={SIZE_CLASS_OPTIONS} cols={4} {...props} />
}
