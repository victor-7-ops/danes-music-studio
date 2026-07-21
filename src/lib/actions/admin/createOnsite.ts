'use server'

import { createClient } from '@/lib/supabase/server'

export type PaymentType = 'unpaid' | 'deposit' | 'full'

export interface CreateOnsiteParams {
  date: string           // "YYYY-MM-DD"
  start: string          // "HH:MM" 24h Manila
  end: string            // "HH:MM" 24h Manila
  customerName: string
  customerEmail?: string
  customerPhone: string
  bandName?: string
  paymentType: PaymentType
}

export async function createOnsite(
  params: CreateOnsiteParams
): Promise<{ success: boolean; error?: string; code?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { date, start, end, customerName, customerEmail, customerPhone, bandName, paymentType } = params

  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date)
  const startOk = /^\d{2}:\d{2}$/.test(start)
  const endOk = /^\d{2}:\d{2}$/.test(end)
  const startHour = parseInt(start.split(':')[0])
  const endHour = parseInt(end.split(':')[0])
  const hoursOk = endHour > startHour
  const nameOk = customerName.trim().length >= 2
  const phoneOk = customerPhone.trim().length >= 7

  if (!dateOk || !startOk || !endOk || !hoursOk || !nameOk || !phoneOk) {
    return { success: false, error: 'Invalid parameters.' }
  }

  const { data: serviceType, error: serviceError } = await supabase
    .from('service_types')
    .select('id, rate_per_hour, deposit_pct')
    .eq('name', 'Rehearsal')
    .single()

  if (serviceError || !serviceType) {
    return { success: false, error: 'Service configuration error.' }
  }

  const hours = endHour - startHour
  const total_amount = hours * serviceType.rate_per_hour
  const deposit_amount = Math.floor(total_amount * serviceType.deposit_pct)

  const code = `DMS-${crypto.randomUUID().replace(/-/g, '').toUpperCase().slice(0, 4)}`

  const start_at = `${date}T${start}:00+08:00`
  const end_at = `${date}T${end}:00+08:00`

  // D-09 status logic
  const status = paymentType === 'unpaid' ? 'pending' : 'confirmed'
  const amount_paid =
    paymentType === 'full' ? total_amount : paymentType === 'deposit' ? deposit_amount : 0
  const payment_method = paymentType === 'unpaid' ? 'none' : paymentType

  const { error: insertError } = await supabase.from('bookings').insert({
    confirmation_code: code,
    customer_name: customerName.trim(),
    customer_email: customerEmail?.trim() ?? '',
    customer_phone: customerPhone.trim(),
    band_name: bandName?.trim() || null,
    start_at,
    end_at,
    service_type_id: serviceType.id,
    status,
    source: 'onsite',
    hold_expires_at: null,
    total_amount,
    deposit_amount,
    amount_paid,
    payment_method,
  })

  if (insertError) {
    if (
      insertError.message.includes('bookings_no_overlap') ||
      insertError.message.includes('exclusion constraint')
    ) {
      return { success: false, error: 'That time slot is already booked.' }
    }
    return { success: false, error: insertError.message }
  }

  return { success: true, code }
}
