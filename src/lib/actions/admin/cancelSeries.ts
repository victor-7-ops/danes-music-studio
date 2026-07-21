'use server'

import { createClient } from '@/lib/supabase/server'
import { cancelBooking } from '@/lib/actions/admin/cancelBooking'

export interface CancelSeriesResult {
  success: boolean
  error?: string
  cancelled: number
  failed: string[] // booking ids that failed to cancel
}

// Thin wrapper: looks up every bookings row sharing a series_id and cancels
// each one via the existing per-row cancelBooking() logic (loop, not a bulk
// UPDATE) so email + gcal side effects fire per occurrence, per plan 031/
// 013a Q5. cancelBooking.ts itself is reused as-is, not modified.
export async function cancelSeries(seriesId: string): Promise<CancelSeriesResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized', cancelled: 0, failed: [] }

  const { data: bookings, error: fetchError } = await supabase
    .from('bookings')
    .select('id, status')
    .eq('series_id', seriesId)

  if (fetchError) {
    return { success: false, error: fetchError.message, cancelled: 0, failed: [] }
  }
  if (!bookings || bookings.length === 0) {
    return { success: false, error: 'Series not found', cancelled: 0, failed: [] }
  }

  let cancelled = 0
  const failed: string[] = []

  for (const booking of bookings) {
    if (booking.status === 'cancelled') continue
    const result = await cancelBooking(booking.id as string)
    if (result.success) {
      cancelled += 1
    } else {
      failed.push(booking.id as string)
    }
  }

  return { success: failed.length === 0, cancelled, failed }
}
