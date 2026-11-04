'use server'

import { createServiceClient } from '@/lib/supabase/serviceClient'
import { SERVICES } from '@/lib/services'
import { validateBookingInput, weeklyDates } from '@/lib/bookingValidation'

export interface CreateRecurringBookingParams {
  date: string; start: string; end: string; service: string
  payment: 'full' | 'deposit'; contactName: string; email: string; phone: string
  bandName: string; equipmentIds?: string[]; occurrenceCount: number
}

export type CreateRecurringBookingResult =
  | { success: true; codes: string[]; tokens: string[]; holdExpiresAt: string }
  | { success: false; error: string; conflicts?: string[] }

export async function createRecurringBooking(params: CreateRecurringBookingParams): Promise<CreateRecurringBookingResult> {
  if (!validateBookingInput(params) || !Number.isInteger(params.occurrenceCount) || params.occurrenceCount < 1 || params.occurrenceCount > 26) {
    return { success: false, error: 'Invalid booking parameters.' }
  }
  const dates = weeklyDates(params.date, params.occurrenceCount)
  const slug = params.service as keyof typeof SERVICES
  const request = {
    date: dates[0], start: params.start, end: params.end, service: SERVICES[slug].name,
    payment: params.payment, name: params.contactName.trim(), email: params.email.trim(),
    phone: params.phone.trim(), band: params.bandName.trim(), equipment_ids: [...new Set(params.equipmentIds ?? [])],
    occurrence_count: params.occurrenceCount,
    occurrences: dates.map(date => ({ date, start_at: `${date}T${params.start}:00+08:00`, end_at: `${date}T${params.end}:00+08:00` })),
  }
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('create_customer_reservations', { p_request: request })
  if (error || !data) {
    const message = error?.message ?? ''
    if (/bookings_no_overlap|exclusion constraint|slot_blocked|outside_operating_hours|studio_closed|booking_must_be_future/i.test(message)) {
      return { success: false, error: 'One or more occurrences are unavailable. Please choose another time.' }
    }
    if (/equipment_unavailable/i.test(message)) return { success: false, error: 'Requested equipment is unavailable for one or more occurrences.' }
    console.error('[createRecurringBooking] atomic reservation failed', error)
    return { success: false, error: 'Something went wrong. Please try again.' }
  }
  const result = data as { codes?: string[]; tokens?: string[]; hold_expires_at?: string }
  if (result.codes?.length !== params.occurrenceCount || result.tokens?.length !== params.occurrenceCount || !result.hold_expires_at) {
    return { success: false, error: 'Reservation result was incomplete.' }
  }
  return { success: true, codes: result.codes, tokens: result.tokens, holdExpiresAt: result.hold_expires_at }
}
