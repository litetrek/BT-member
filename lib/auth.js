import GoogleProvider from 'next-auth/providers/google'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // Upsert user into public.users
      const { error } = await supabase
        .from('users')
        .upsert(
          {
            email: user.email,
            name: user.name,
            avatar_url: user.image,
          },
          { onConflict: 'email' }
        )
      if (error) console.error('Supabase upsert error:', error)
      return true
    },

    async session({ session, token }) {
      // Attach Supabase user id + role to session
      const { data: dbUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .single()

      if (dbUser) {
        session.user.id = dbUser.id

        // Check if this user is an admin in any event
        const { data: membership } = await supabase
          .from('event_members')
          .select('role')
          .eq('user_id', dbUser.id)
          .eq('role', 'admin')
          .limit(1)
          .single()

        session.user.role = membership?.role ?? 'member'
      }
      return session
    },

    async jwt({ token, user }) {
      if (user) token.email = user.email
      return token
    },
  },
  pages: {
    signIn: '/',
  },
  secret: process.env.NEXTAUTH_SECRET,
}

// Server-side helper: returns null if user is admin, else NextResponse redirect
export async function requireAdmin(req) {
  const { getServerSession } = await import('next-auth')
  const { NextResponse } = await import('next/server')
  const session = await getServerSession(req, undefined, authOptions)
  if (!session || session.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}
