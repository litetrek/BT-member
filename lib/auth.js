import GoogleProvider from 'next-auth/providers/google'
import { query } from '@/lib/db'
import { INVENTORY_ROLE_PRIORITY } from '@/lib/inventory'

const ROLE_PRIORITY = { admin: 3, lead: 2, member: 1 }

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      try {
        // ON CONFLICT only updates name/avatar_url — preferred_lang default ('zh')
        // fires on first insert only and is never overwritten here.
        await query(
          `INSERT INTO users (email, name, avatar_url, last_signed_in_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (email) DO UPDATE SET
             name              = EXCLUDED.name,
             avatar_url        = EXCLUDED.avatar_url,
             last_signed_in_at = NOW()`,
          [user.email, user.name, user.image]
        )
      } catch (err) {
        console.error('DB upsert error:', err)
      }
      return true
    },

    async session({ session }) {
      try {
        const { rows } = await query(
          'SELECT id, preferred_lang FROM users WHERE email = $1',
          [session.user.email]
        )
        const dbUser = rows[0]

        if (dbUser) {
          session.user.id             = dbUser.id
          session.user.preferred_lang = dbUser.preferred_lang ?? 'zh'

          const { rows: memberships } = await query(
            'SELECT role FROM event_members WHERE user_id = $1',
            [dbUser.id]
          )

          const bestRole = memberships.reduce((best, m) => {
            return (ROLE_PRIORITY[m.role] ?? 0) > (ROLE_PRIORITY[best] ?? 0) ? m.role : best
          }, 'member')

          session.user.role = bestRole

          // Per-module Inventory Control roles (lib/inventory.js's getInventoryRole reads
          // this, not a hardcoded map — see inventory_module_access).
          const { rows: moduleAccess } = await query(
            'SELECT module_key, role FROM inventory_module_access WHERE email = $1',
            [session.user.email]
          )
          session.user.inventoryRoles = Object.fromEntries(moduleAccess.map((m) => [m.module_key, m.role]))
        }
      } catch (err) {
        console.error('[auth] session callback error:', err.message)
      }
      return session
    },

    async jwt({ token, user }) {
      if (user) token.email = user.email
      return token
    },
  },
  pages: { signIn: '/' },
  secret: process.env.NEXTAUTH_SECRET,
}

// Pages router helper: sends 403 and returns true if not admin. Returns false if admin (proceed).
export async function requireAdmin(req, res) {
  const { getServerSession } = await import('next-auth')
  const session = await getServerSession(req, res, authOptions)
  if (!session || session.user?.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' })
    return true
  }
  return false
}

// Pages router helper for Inventory Control API routes: sends 403 and returns null if the
// signed-in user's role in moduleKey doesn't meet minRole. Returns the role string if
// allowed, and stamps req.inventoryEmail with the session email for created_by/log-entry
// use. moduleKey defaults to 'lanterns' since every existing /api/inventory/* route is
// Lantern-specific; pass it explicitly for routes belonging to a different module.
export async function requireInventoryRole(req, res, minRole = 'viewer', moduleKey = 'lanterns') {
  const { getServerSession } = await import('next-auth')
  const session = await getServerSession(req, res, authOptions)
  const email = session?.user?.email
  const { rows } = email
    ? await query('SELECT role FROM inventory_module_access WHERE email = $1 AND module_key = $2', [email, moduleKey])
    : { rows: [] }
  const role = rows[0]?.role ?? null
  if (!role || (INVENTORY_ROLE_PRIORITY[role] ?? 0) < (INVENTORY_ROLE_PRIORITY[minRole] ?? 0)) {
    res.status(403).json({ error: 'Forbidden' })
    return null
  }
  req.inventoryEmail = email
  return role
}
