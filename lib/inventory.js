// Per-module roles for the Inventory Control area, read from the NextAuth session
// (session.user.inventoryRoles, populated in lib/auth.js's session callback from the
// inventory_module_access table) — not a hardcoded map anymore. Managed via the
// unified admin screen at /admin/users. Roles: admin > editor > viewer.
// NOTE: client-safe module (imported by pages/index.jsx etc.) — no server-only imports here.
export const INVENTORY_ROLE_PRIORITY = { admin: 3, editor: 2, viewer: 1 }

export function getInventoryRole(session, moduleKey = 'lanterns') {
  return session?.user?.inventoryRoles?.[moduleKey] ?? null
}

// True if the session's role in moduleKey is at least minRole (admin > editor > viewer).
export function hasInventoryRole(session, moduleKey, minRole) {
  const role = getInventoryRole(session, moduleKey)
  if (!role) return false
  return (INVENTORY_ROLE_PRIORITY[role] ?? 0) >= (INVENTORY_ROLE_PRIORITY[minRole] ?? 0)
}

// True if the session holds 'admin' in ANY inventory module — used to decide whether
// to surface the unified admin screen's Inventory Control section at all.
export function isInventoryAdminOfAny(session) {
  return Object.values(session?.user?.inventoryRoles ?? {}).includes('admin')
}

// Inventory subsystems shown on the hub page. Add new entries here as they're built.
export const INVENTORY_MODULES = [
  { key: 'lanterns', name: '燈籠庫存', nameEn: 'Lantern Inventory', href: '/inventory/lanterns' },
]
