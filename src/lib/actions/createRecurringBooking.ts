'use server'

import { createClient } from '@/lib/supabase/server'
import { SERVICES, isServiceSlug } from '@/lib/services'
import { computeTotal } from '@/lib/slotSelection'
import { getUnavailableEquipment } from '@/lib/equipmentAvailability'

export interface CreateRecurringBookingParams {
  date: string       // "YYYY-MM-DD" — first occurrence, weekly cadence from here
  start: string      // "HH:MM" 24h Manila
  end: string        // "HH:MM" 24h Manila
  service: string    // service slug, see SERVICES
  payment: 'full' | 'deposit'
  contactName: string
  email: string
  phone: string
  bandName: string   // empty string if none
  equipmentIds?: string[]
  occurrenceCount: number // 1-26
}

export type CreateRecurringBookingResult =
  | { success: true; codes: string[] }
  | { success: false; error: string; conflicts?: string[] }

interface Occurrence {
  date: string
  start_at: string
  end_at: string
}

// Adds `weeks * 7` days to a "YYYY-MM-DD" date string, staying in the same
// naive calendar arithmetic used elsewhere in this flow (no external date lib).
function addWeeks(date: string, weeks: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + weeks * 7)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

export async function createRecurringBooking(
  params: CreateRecurringBookingParams
): Promise<CreateRecurringBookingResult> {
  const { date, start, end, service, payment, contactName, email, phone, occurrenceCount } = params

  // 1. Server-side validation — never trust client
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date)
  const startOk = /^\d{2}:\d{2}$/.test(start)
  const endOk = /^\d{2}:\d{2}$/.test(end)
  const paymentOk = payment === 'full' || payment === 'deposit'
  const serviceOk = isServiceSlug(service)
  const nameOk = contactName.trim().length >= 2
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const phoneOk = phone.trim().length >= 7
  const countOk = Number.isInteger(occurrenceCount) && occurrenceCount >= 1 && occurrenceCount <= 26

  const startHour = parseInt(start.split(':')[0])
  const endHour = parseInt(end.split(':')[0])
  const hoursOk = endHour > startHour

  if (!dateOk || !startOk || !endOk || !serviceOk || !paymentOk || !nameOk || !emailOk || !phoneOk || !hoursOk || !countOk) {
    return { success: false, error: 'Invalid booking parameters.' }
  }

  // 2. Compute all N occurrence windows server-side (don't trust a
  // client-computed list — same "server computes" invariant as pricing).
  const occurrences: Occurrence[] = Array.from({ length: occurrenceCount }, (_, i) => {
    const occDate = addWeeks(date, i)
    return {
      date: occDate,
      start_at: `${occDate}T${start}:00+08:00`,
      end_at: `${occDate}T${end}:00+08:00`,
    }
  })
  const minStart = occurrences[0].start_at
  const maxEnd = occurrences[occurrences.length - 1].end_at

  // 3. Create Supabase client
  const supabase = await createClient()

  // 4. Fetch service type + settings + selected equipment in parallel
  const equipmentIds = [...new Set(params.equipmentIds ?? [])]
  const [serviceTypeResult, settingsResult, equipmentResult] = await Promise.all([
    supabase
      .from('service_types')
      .select('id, rate_per_hour, deposit_pct')
      .eq('name', SERVICES[service as keyof typeof SERVICES].name)
      .eq('active', true)
      .single(),
    supabase
      .from('settings')
      .select('hold_window_minutes')
      .single(),
    equipmentIds.length > 0
      ? supabase
          .from('equipment')
          .select('id, name, price_per_session, quantity')
          .in('id', equipmentIds)
          .eq('active', true)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (serviceTypeResult.error || !serviceTypeResult.data) {
    return { success: false, error: 'Service configuration error.' }
  }
  if (settingsResult.error || !settingsResult.data) {
    return { success: false, error: 'Service configuration error.' }
  }
  if (equipmentResult.error) {
    return { success: false, error: 'Equipment configuration error.' }
  }

  const serviceType = serviceTypeResult.data
  const settings = settingsResult.data
  const selectedEquipment = equipmentResult.data ?? []

  // 5. Pre-check: fetch existing non-cancelled bookings anywhere within the
  // full [minStart, maxEnd] span in a single query, then test each of the N
  // occurrences against that set in JS. This is a fast-path UX check only —
  // the bookings_no_overlap EXCLUDE constraint remains the authoritative
  // backstop for the race window between this check and the insert below,
  // same pattern createBooking.ts relies on for single bookings.
  const { data: existingBookings, error: existingError } = await supabase
    .from('bookings')
    .select('start_at, end_at')
    .neq('status', 'cancelled')
    .gte('end_at', minStart)
    .lte('start_at', maxEnd)

  if (existingError) {
    return { success: false, error: 'Something went wrong. Please try again.' }
  }

  const existingRanges = (existingBookings ?? []).map(row => ({
    start: new Date(row.start_at as string),
    end: new Date(row.end_at as string),
  }))

  const dateConflicts = occurrences.filter(occ => {
    const occStart = new Date(occ.start_at)
    const occEnd = new Date(occ.end_at)
    return existingRanges.some(r => r.start < occEnd && r.end > occStart)
  })

  if (dateConflicts.length > 0) {
    return {
      success: false,
      error: 'One or more occurrences conflict with an existing booking.',
      conflicts: dateConflicts.map(c => c.date),
    }
  }

  // 5b. Equipment conflict pre-check, same idea as 5 but scoped to selected
  // gear — mirrors createBooking.ts's step 5b, just tested per occurrence.
  if (selectedEquipment.length > 0) {
    const { data: usageRows, error: usageError } = await supabase
      .from('booking_equipment')
      .select('equipment_id, bookings!inner(status, start_at, end_at)')
      .in(
        'equipment_id',
        selectedEquipment.map(item => item.id)
      )
      .neq('bookings.status', 'cancelled')
      .gte('bookings.end_at', minStart)
      .lte('bookings.start_at', maxEnd)

    if (usageError) {
      return { success: false, error: 'Equipment configuration error.' }
    }

    const existingUsage = (usageRows ?? []).map(row => {
      const booking = Array.isArray(row.bookings) ? row.bookings[0] : row.bookings
      return {
        equipmentId: row.equipment_id as string,
        startAt: new Date(booking.start_at as string),
        endAt: new Date(booking.end_at as string),
      }
    })

    const equipmentConflicts = occurrences.filter(occ => {
      const unavailable = getUnavailableEquipment(
        selectedEquipment.map(item => ({ id: item.id, name: item.name, quantity: item.quantity })),
        existingUsage,
        new Date(occ.start_at),
        new Date(occ.end_at)
      )
      return unavailable.length > 0
    })

    if (equipmentConflicts.length > 0) {
      return {
        success: false,
        error: 'Requested equipment is unavailable for one or more occurrences.',
        conflicts: equipmentConflicts.map(c => c.date),
      }
    }
  }

  // 6. Insert booking_series row
  const { data: series, error: seriesError } = await supabase
    .from('booking_series')
    .insert({ recurrence_pattern: 'weekly', occurrence_count: occurrenceCount })
    .select('id')
    .single()

  if (seriesError || !series) {
    return { success: false, error: 'Something went wrong. Please try again.' }
  }

  // 7. Build + bulk-insert N booking rows, each priced independently
  // (Option B — per-occurrence payment, see plans/013a and 031).
  const hours = endHour - startHour
  const equipment_total = selectedEquipment.reduce((sum, item) => sum + item.price_per_session, 0)
  const { totalCents: total_amount, depositCents: deposit_amount } = computeTotal(
    hours,
    serviceType.rate_per_hour,
    serviceType.deposit_pct,
    equipment_total
  )
  const hold_expires_at = new Date(Date.now() + settings.hold_window_minutes * 60_000).toISOString()

  const codes = occurrences.map(() => `DMS-${crypto.randomUUID().replace(/-/g, '').toUpperCase().slice(0, 4)}`)

  const rows = occurrences.map((occ, i) => ({
    confirmation_code: codes[i],
    customer_name: params.contactName.trim(),
    customer_email: params.email.trim(),
    customer_phone: params.phone.trim(),
    band_name: params.bandName.trim() || null,
    start_at: occ.start_at,
    end_at: occ.end_at,
    service_type_id: serviceType.id,
    status: 'pending',
    source: 'online',
    hold_expires_at,
    total_amount,
    deposit_amount,
    amount_paid: 0,
    payment_method: payment,
    series_id: series.id,
  }))

  const { data: inserted, error: insertError } = await supabase
    .from('bookings')
    .insert(rows)
    .select('id, start_at, end_at')

  if (insertError || !inserted || inserted.length !== occurrenceCount) {
    // Compensate: remove the series row (and any partial bookings rows —
    // shouldn't exist since insert() is one statement, but be defensive).
    await supabase.from('bookings').delete().eq('series_id', series.id)
    await supabase.from('booking_series').delete().eq('id', series.id)

    if (
      insertError?.message.includes('bookings_no_overlap') ||
      insertError?.message.includes('exclusion constraint')
    ) {
      return {
        success: false,
        error: 'One or more occurrences were just taken. Please try again.',
      }
    }
    return { success: false, error: 'Something went wrong. Please try again.' }
  }

  // 8. Equipment: reserve per-occurrence, one reserve_equipment RPC call per
  // booking_id (the RPC is scoped to a single booking by design — see
  // 20260022000000_equipment_atomic_reserve.sql — looping it here rather
  // than extending its signature, per plan 031 scope).
  if (selectedEquipment.length > 0) {
    for (const booking of inserted) {
      const { data: unavailableRows, error: reserveError } = await supabase.rpc(
        'reserve_equipment',
        {
          p_booking_id: booking.id,
          p_start_at: booking.start_at,
          p_end_at: booking.end_at,
          p_items: selectedEquipment.map(item => ({
            equipment_id: item.id,
            price_at_booking: item.price_per_session,
          })),
        }
      )

      if (reserveError || (unavailableRows && unavailableRows.length > 0)) {
        // Compensate: cascade-deletes booking_equipment rows via FK, then
        // remove all bookings + the series row for this failed series.
        await supabase.from('bookings').delete().eq('series_id', series.id)
        await supabase.from('booking_series').delete().eq('id', series.id)

        if (reserveError) {
          console.error('[createRecurringBooking] reserve_equipment RPC failed', reserveError)
          return { success: false, error: 'Something went wrong. Please try again.' }
        }
        return {
          success: false,
          error: `${unavailableRows!.map((row: { unavailable_name: string }) => row.unavailable_name).join(', ')} unavailable for one or more occurrences.`,
        }
      }
    }
  }

  return { success: true, codes }
}
