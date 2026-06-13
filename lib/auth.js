import GoogleProvider from 'next-auth/providers/google'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

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
      const { error } = await supabase
        .from('users')
        .upsert(
          { email: user.email, name: user.name, avatar_url: user.image },
          { onConflict: 'email' }
        )
      if (error) console.error('Supabase upsert error:', error)
      return true
    },

    async session({ session }) {
      const { data: dbUser, error: dbErr } = await supabase
        .from('users')
        .select('id, preferred_lang')
        .eq('email', session.user.email)
        .single()

      if (dbErr) console.error('[auth] session user lookup failed:', dbErr.message)

      if (dbUser) {
        session.user.id             = dbUser.id
        session.user.preferred_lang = dbUser.preferred_lang ?? 'zh'

        const { data: memberships } = await supabase
          .from('event_members')
          .select('role')
          .eq('user_id', dbUser.id)

        const bestRole = (memberships ?? []).reduce((best, m) => {
          return (ROLE_PRIORITY[m.role] ?? 0) > (ROLE_PRIORITY[best] ?? 0) ? m.role : best
        }, 'member')

        session.user.role = bestRole
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
