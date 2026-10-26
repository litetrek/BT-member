// Email → role map for the Inventory Control module.
// This is separate from event_members roles — access here is granted per Gmail
// account, not per event. Add/remove addresses as needed. Roles: admin > editor > viewer.
// NOTE: client-safe module (imported by pages/index.jsx etc.) — no server-only imports here.
export const INVENTORY_ACCESS = {
  'vlin77@gmail.com': 'admin',
  'joannazhao168@gmail.com': 'editor',
  'weiyanoble@gmail.com': 'editor',
  'qqandcici@gmail.com': 'editor',
  'pai8788@gmail.com': 'editor',
}

export const INVENTORY_ROLE_PRIORITY = { admin: 3, editor: 2, viewer: 1 }

export function getInventoryRole(email) {
  if (!email) return null
  return INVENTORY_ACCESS[email.toLowerCase()] ?? null
}

// True if email's role is at least minRole (admin > editor > viewer).
export function hasInventoryRole(email, minRole) {
  const role = getInventoryRole(email)
  if (!role) return false
  return (INVENTORY_ROLE_PRIORITY[role] ?? 0) >= (INVENTORY_ROLE_PRIORITY[minRole] ?? 0)
}

// Inventory subsystems shown on the hub page. Add new entries here as they're built.
export const INVENTORY_MODULES = [
  { key: 'lanterns', name: '燈籠庫存', nameEn: 'Lantern Inventory', href: '/inventory/lanterns' },
]
