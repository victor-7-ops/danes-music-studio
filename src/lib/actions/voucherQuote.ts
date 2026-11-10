'use server'

import { createServiceClient } from '@/lib/supabase/serviceClient'
import { SERVICES, isServiceSlug } from '@/lib/services'

export interface VoucherQuoteParams {
  code: string
  service: string
  sessionDate: string
  studioSubtotalCents: number
  equipmentSubtotalCents: number
  email: string
}

export type VoucherQuoteResult =
  | { valid: true; discountCents: number }
  | { valid: false; reason: string }

export async function quoteVoucher(params: VoucherQuoteParams): Promise<VoucherQuoteResult> {
  const code = params.code.trim()
  if (!code || !isServiceSlug(params.service)) return { valid: false, reason: 'voucher_not_found' }
  const supabase = createServiceClient()
  const { data: serviceType } = await supabase
    .from('service_types')
    .select('id')
    .eq('name', SERVICES[params.service].name)
    .single()
  if (!serviceType) return { valid: false, reason: 'voucher_not_found' }

  const { data, error } = await supabase.rpc('preview_voucher_discount', {
    p_code: code,
    p_service_id: serviceType.id,
    p_session_date: params.sessionDate,
    p_studio_subtotal: params.studioSubtotalCents,
    p_equipment_subtotal: params.equipmentSubtotalCents,
    p_email: params.email,
  })
  if (error || !data) return { valid: false, reason: 'voucher_not_found' }
  const result = data as { valid: boolean; discount?: number; reason?: string }
  if (!result.valid) return { valid: false, reason: result.reason ?? 'voucher_not_found' }
  return { valid: true, discountCents: result.discount ?? 0 }
}
