'use server'

import { createClient } from '@/lib/supabase/server'

export interface CreateBookingParams {
  date: string       // "YYYY-MM-DD"
  start: string      // "HH:MM" 24h Manila
  end: string        // "HH:MM" 24h Manila
  payment: 'full' | 'deposit'
  contactName: string
  email: string
  phone: string
  bandName: string   // empty string if none
}

export type CreateBookingResult =
  | { success: true; code: string }
  | { success: false; error: string }

export async function createBooking(
  params: CreateBookingParams
): Promise<CreateBookingResult> {
  const { date, start, end, payment, contactName, email, phone } = params

  // 1. Server-side validation — never trust client
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date)
  const startOk = /^\d{2}:\d{2}$/.test(start)
  const endOk = /^\d{2}:\d{2}$/.test(end)
  const paymentOk = payment === 'full' || payment === 'deposit'
  const nameOk = contactName.trim().length >= 2
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const phoneOk = phone.trim().length >= 7

  const startHour = parseInt(start.split(':')[0])
  const endHour = parseInt(end.split(':')[0])
  const hoursOk = endHour > startHour

  if (!dateOk || !startOk || !endOk || !paymentOk || !nameOk || !emailOk || !phoneOk || !hoursOk) {
    return { success: false, error: 'Invalid booking parameters.' }
  }

  // 2. Create Supabase client
  const supabase = await createClient()

  // 3. Fetch service type + settings in parallel
  const [serviceTypeResult, settingsResult] = await Promise.all([
    supabase
      .from('service_types')
      .select('id, rate_per_hour')
      .eq('name', 'Rehearsal')
      .single(),
    supabase
      .from('settings')
      .select('hold_window_minutes')
      .single(),
  ])

  if (serviceTypeResult.error || !serviceTypeResult.data) {
    return { success: false, error: 'Service configuration error.' }
  }
  if (settingsResult.error || !settingsResult.data) {
    return { success: false, error: 'Service configuration error.' }
  }

  const serviceType = serviceTypeResult.data
  const settings = settingsResult.data

  // Server-side pricing — never trust client-sent amounts (CLAUDE.md invariant 3)
  const hours = endHour - startHour
  const total_amount = hours * serviceType.rate_per_hour   // integer centavos
  const deposit_amount = Math.floor(total_amount / 2)

  // 5. Generate confirmation code
  const chars = crypto.randomUUID().replace(/-/g, '').toUpperCase().slice(0, 4)
  const code = `DMS-${chars}`

  // 6. Compute timestamps
  const start_at = `${date}T${start}:00+08:00`
  const end_at = `${date}T${end}:00+08:00`
  // Hold window from settings table — never hardcoded (CLAUDE.md invariant 4)
  const hold_expires_at = new Date(Date.now() + settings.hold_window_minutes * 60_000).toISOString()

  // 7. Insert into bookings
  const { error: insertError } = await supabase.from('bookings').insert({
    confirmation_code: code,
    customer_name: params.contactName.trim(),
    customer_email: params.email.trim(),
    customer_phone: params.phone.trim(),
    band_name: params.bandName.trim() || null,
    start_at,
    end_at,
    service_type_id: serviceType.id,
    status: 'pending',
    source: 'online',
    hold_expires_at,
    total_amount,
    deposit_amount,
    amount_paid: 0,
  })

  // 8. Error handling
  if (insertError) {
    if (
      insertError.message.includes('bookings_no_overlap') ||
      insertError.message.includes('exclusion constraint')
    ) {
      return {
        success: false,
        error: 'That time slot was just taken. Please choose different hours.',
      }
    }
    return { success: false, error: 'Something went wrong. Please try again.' }
  }

  // 9. Success
  return { success: true, code }
}
