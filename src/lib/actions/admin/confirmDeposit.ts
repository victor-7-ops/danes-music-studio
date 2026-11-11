'use server'

import { createClient } from '@/lib/supabase/server'
import { applyPaymentConfirmation } from '@/lib/bookingOps/confirmPayment'

export async function confirmDeposit(
  bookingId: string,
  amountReceived: number,
  paymentType?: 'full' | 'deposit'
): Promise<{ success: boolean; error?: string; warning?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') return { success: false, error: 'Unauthorized' }

  return applyPaymentConfirmation(supabase, bookingId, amountReceived, paymentType)
}
