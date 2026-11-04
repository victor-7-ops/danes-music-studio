import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Bypasses RLS — only use in trusted server contexts where authorization is
// already enforced by other means (unguessable token match, cron secret,
// admin session), never expose to a route with no independent access check.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing required server Supabase environment variables.')
  return createSupabaseClient<Database>(
    url,
    key,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      // Next.js patches the server-side global fetch with its own Data Cache
      // layer, which caches plain GETs (including supabase-js's REST calls)
      // by default regardless of route `dynamic` config. This client always
      // needs read-your-writes freshness (cancel/reschedule/proof status),
      // so force every request to bypass that cache.
      global: {
        fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
      },
    }
  )
}
