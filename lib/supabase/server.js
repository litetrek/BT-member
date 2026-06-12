import { createClient } from '@supabase/supabase-js'

// Service role key bypasses RLS — API routes enforce auth themselves via getServerSession
export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}
