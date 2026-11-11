'use server'

import { createClient } from '@/lib/supabase/server'
import { applyBookingCancellation } from '@/lib/bookingOps/cancelBooking'

export async function cancelBooking(
  bookingId: string
): Promise<{ success: boolean; error?: string; warning?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') return { success: false, error: 'Unauthorized' }

  return applyBookingCancellation(supabase, bookingId)
}
