'use server'

import { createServiceClient } from '@/lib/supabase/serviceClient'
import { SERVICES } from '@/lib/services'
import { validateBookingInput, weeklyDates } from '@/lib/bookingValidation'

export interface CreateBookingParams {
  date: string; start: string; end: string; service: string
  payment: 'full' | 'deposit'; contactName: string; email: string; phone: string
  bandName: string; equipmentIds?: string[]; voucherCode?: string
}

export type CreateBookingResult =
  | { success: true; code: string; token: string; holdExpiresAt: string }
  | { success: false; error: string }

export async function createBooking(params: CreateBookingParams): Promise<CreateBookingResult> {
  if (!validateBookingInput(params)) return { success: false, error: 'Invalid booking parameters.' }
  const supabase = createServiceClient()
  const slug = params.service as keyof typeof SERVICES
  const date = weeklyDates(params.date, 1)[0]
  const request = {
    date, start: params.start, end: params.end, service: SERVICES[slug].name,
    payment: params.payment, name: params.contactName.trim(), email: params.email.trim(),
    phone: params.phone.trim(), band: params.bandName.trim(), equipment_ids: [...new Set(params.equipmentIds ?? [])],
    occurrence_count: 1,
    occurrences: [{ date, start_at: `${date}T${params.start}:00+08:00`, end_at: `${date}T${params.end}:00+08:00` }],
    voucher_code: params.voucherCode?.trim() || null,
  }
  const { data, error } = await supabase.rpc('create_customer_reservations', { p_request: request })
  if (error || !data) {
    const message = error?.message ?? ''
    if (/booking_must_be_future|outside_operating_hours|studio_closed|slot_blocked/i.test(message)) {
      return { success: false, error: 'That time is no longer available. Choose a future time during studio hours.' }
    }
    if (/bookings_no_overlap|exclusion constraint/i.test(message)) return { success: false, error: 'That time slot was just taken. Please choose different hours.' }
    if (/equipment_unavailable/i.test(message)) return { success: false, error: 'Requested equipment is unavailable for the selected time.' }
    if (/voucher_not_found|voucher_disabled|voucher_not_yet_valid|voucher_expired|voucher_service_ineligible|voucher_date_out_of_range|voucher_min_spend_not_met|voucher_exhausted|voucher_customer_limit_reached/i.test(message)) {
      return { success: false, error: 'That voucher code is not valid for this booking.' }
    }
    console.error('[createBooking] atomic reservation failed', error)
    return { success: false, error: 'Something went wrong. Please try again.' }
  }
  const result = data as { codes?: string[]; tokens?: string[]; hold_expires_at?: string }
  if (!result.codes?.[0] || !result.tokens?.[0] || !result.hold_expires_at) return { success: false, error: 'Reservation result was incomplete.' }
  return { success: true, code: result.codes[0], token: result.tokens[0], holdExpiresAt: result.hold_expires_at }
}
