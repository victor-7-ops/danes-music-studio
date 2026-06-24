'use server'

import { createClient } from '@/lib/supabase/server'
import { stopWatchChannel } from '@/lib/gcal/client'

export async function disconnectGoogleCalendar(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  // Fetch the current row to get watch channel info
  const { data: row } = await supabase
    .from('google_tokens')
    .select('id, watch_channel_id, watch_resource_id')
    .single()

  if (!row) {
    // Already disconnected — idempotent
    return { success: true }
  }

  // Fire-and-forget: stop the watch channel if registered
  if (row.watch_channel_id && row.watch_resource_id) {
    void stopWatchChannel({
      channelId: row.watch_channel_id as string,
      resourceId: row.watch_resource_id as string,
    }).catch((err) => console.error('[gcal:disconnect] stopWatchChannel failed', err))
  }

  // Delete the token row
  await supabase.from('google_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  return { success: true }
}
