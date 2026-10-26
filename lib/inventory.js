// Email allowlist for the Inventory Control module.
// This is separate from event_members roles — access here is granted per Gmail
// account, not per event. Add/remove addresses as needed.
export const INVENTORY_ACCESS = {
  admin: ['vlin77@gmail.com'],
  editor: [
    'joannazhao168@gmail.com',
    'weiyanoble@gmail.com',
    'qqandcici@gmail.com',
    'pai8788@gmail.com',
  ],
}

export function getInventoryRole(email) {
  if (!email) return null
  const normalized = email.toLowerCase()
  if (INVENTORY_ACCESS.admin.includes(normalized)) return 'admin'
  if (INVENTORY_ACCESS.editor.includes(normalized)) return 'editor'
  return null
}

// Inventory subsystems shown on the hub page. Add new entries here as they're built.
export const INVENTORY_MODULES = [
  { key: 'lanterns', name: '燈籠庫存', nameEn: 'Lantern Inventory', href: '/inventory/lanterns' },
]
