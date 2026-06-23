'use server'

import { createClient } from '@/lib/supabase/server'

export async function confirmDeposit(
  bookingId: string,
  amountReceived: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  if (!bookingId || typeof bookingId !== 'string') {
    return { success: false, error: 'Invalid booking ID.' }
  }
  if (typeof amountReceived !== 'number' || amountReceived < 0) {
    return { success: false, error: 'Invalid amount.' }
  }

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'confirmed', amount_paid: amountReceived })
    .eq('id', bookingId)
    .neq('status', 'cancelled')

  if (error) return { success: false, error: error.message }
  return { success: true }
}
