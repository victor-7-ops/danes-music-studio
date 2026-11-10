'use server'

import { createClient } from '@/lib/supabase/server'

export interface UpsertVoucherParams {
  id?: string
  code: string
  percent: number
  enabled?: boolean
  startsAt?: string | null
  expiresAt?: string | null
  maxRedemptions?: number | null
  minStudioSubtotalCentavos?: number | null
  maxDiscountCentavos?: number | null
  perCustomerLimit?: number | null
}

export async function upsertVoucher(params: UpsertVoucherParams): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('upsert_voucher', {
    p_voucher: {
      id: params.id ?? null,
      code: params.code.trim(),
      percent: params.percent,
      enabled: params.enabled ?? true,
      starts_at: params.startsAt || null,
      expires_at: params.expiresAt || null,
      max_redemptions: params.maxRedemptions ?? null,
      min_studio_subtotal_centavos: params.minStudioSubtotalCentavos ?? null,
      max_discount_centavos: params.maxDiscountCentavos ?? null,
      per_customer_limit: params.perCustomerLimit ?? null,
    },
  })
  if (error) return { success: false, error: error.message }
  return { success: true }
}
