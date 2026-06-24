'use server'

import { createClient } from '@/lib/supabase/server'
import { runPullSync } from '@/lib/gcal/pullSync'

export async function syncGoogleCalendar(): Promise<{
  success: boolean
  inserted?: number
  deleted?: number
  conflicts?: number
  error?: string
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  try {
    const result = await runPullSync()
    return { success: true, ...result }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Sync failed',
    }
  }
}
