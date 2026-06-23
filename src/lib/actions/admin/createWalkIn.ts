'use server'

import { createClient } from '@/lib/supabase/server'

export interface CreateWalkInParams {
  date: string      // "YYYY-MM-DD"
  start: string     // "HH:MM" 24h Manila
  end: string       // "HH:MM" 24h Manila
  bandName?: string
}

export async function createWalkIn(
  params: CreateWalkInParams
): Promise<{ success: boolean; error?: string; code?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { date, start, end, bandName } = params

  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date)
  const startOk = /^\d{2}:\d{2}$/.test(start)
  const endOk = /^\d{2}:\d{2}$/.test(end)
  const startHour = parseInt(start.split(':')[0])
  const endHour = parseInt(end.split(':')[0])
  const hoursOk = endHour > startHour

  if (!dateOk || !startOk || !endOk || !hoursOk) {
    return { success: false, error: 'Invalid parameters.' }
  }

  const start_at = `${date}T${start}:00+08:00`
  const end_at = `${date}T${end}:00+08:00`

  // CRITICAL: App-level overlap check — walk_in completed rows bypass the EXCLUDE constraint
  const { data: conflicts, error: overlapError } = await supabase
    .from('bookings')
    .select('id')
    .in('status', ['pending', 'confirmed'])
    .lt('start_at', end_at)
    .gt('end_at', start_at)

  if (overlapError) return { success: false, error: overlapError.message }
  if (conflicts && conflicts.length > 0) {
    return { success: false, error: 'Time slot overlaps an existing booking.' }
  }

  const { data: serviceType, error: serviceError } = await supabase
    .from('service_types')
    .select('id, rate_per_hour')
    .eq('name', 'Rehearsal')
    .single()

  if (serviceError || !serviceType) {
    return { success: false, error: 'Service configuration error.' }
  }

  const hours = endHour - startHour
  const total_amount = hours * serviceType.rate_per_hour
  const deposit_amount = Math.floor(total_amount / 2)

  const code = `DMS-${crypto.randomUUID().replace(/-/g, '').toUpperCase().slice(0, 4)}`

  const { error: insertError } = await supabase.from('bookings').insert({
    confirmation_code: code,
    customer_name: bandName?.trim() || 'Walk-in',
    customer_email: '',
    customer_phone: '',
    band_name: bandName?.trim() || null,
    start_at,
    end_at,
    service_type_id: serviceType.id,
    status: 'completed',
    source: 'walk_in',
    hold_expires_at: null,
    total_amount,
    deposit_amount,
    amount_paid: total_amount,
    payment_method: 'none',
  })

  if (insertError) return { success: false, error: insertError.message }
  return { success: true, code }
}
