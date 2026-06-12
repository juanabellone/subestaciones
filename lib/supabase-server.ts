import { createClient } from '@supabase/supabase-js'

// Cliente con service role — bypasea RLS, solo para uso server-side
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
