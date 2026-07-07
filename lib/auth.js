import GoogleProvider from 'next-auth/providers/google'
import { query } from '@/lib/db'

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
          `INSERT INTO users (email, name, avatar_url)
           VALUES ($1, $2, $3)
           ON CONFLICT (email) DO UPDATE SET
             name       = EXCLUDED.name,
             avatar_url = EXCLUDED.avatar_url`,
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
