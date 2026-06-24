import { createClient } from '@supabase/supabase-js'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function manilaIso(date: Date, hour: number, minute = 0): string {
  // date is a UTC-midnight anchor representing a Manila calendar date.
  // Use UTC accessors so the result is timezone-agnostic.
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hh = String(hour).padStart(2, '0')
  const mm = String(minute).padStart(2, '0')
  return `${year}-${month}-${day}T${hh}:${mm}:00+08:00`
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

async function seed(): Promise<void> {
  console.log('Seeding database...')

  // Upsert Rehearsal service_type (idempotent via onConflict: 'name')
  const { data: st, error: stErr } = await supabase
    .from('service_types')
    .upsert(
      { name: 'Rehearsal', rate_per_hour: 35000, deposit_percent: 0.5 },
      { onConflict: 'name' }
    )
    .select('id')
    .single()

  if (stErr || !st) {
    console.error('service_type upsert failed', stErr)
    process.exit(1)
  }

  console.log(`service_type id: ${st.id}`)

  // Use today's Manila date as reference
  const nowUtc = new Date()
  // We work with local calendar dates for Manila (+08:00), offsetting by 8h
  const manilaOffset = 8 * 60 * 60 * 1000
  const manilaToday = new Date(nowUtc.getTime() + manilaOffset)
  // Normalize to midnight Manila to avoid DST quirks
  const todayManila = new Date(
    Date.UTC(manilaToday.getUTCFullYear(), manilaToday.getUTCMonth(), manilaToday.getUTCDate())
  )

  const holdExpires = new Date(nowUtc.getTime() + 15 * 60 * 1000).toISOString()

  // Amounts in centavos. rate = ₱350/hr = 35000 centavos
  const RATE_PER_HOUR = 35000
  const total2h = RATE_PER_HOUR * 2  // 70000
  const deposit2h = Math.floor(total2h / 2)  // 35000

  type SeedBooking = {
    confirmation_code: string
    status: string
    source: string
    start_at: string
    end_at: string
    total_amount: number
    deposit_amount: number
    amount_paid: number
    hold_expires_at: string | null
    customer_name: string
    customer_email: string
    customer_phone: string
    band_name: string
    service_type_id: string
  }

  const bookings: SeedBooking[] = [
    {
      confirmation_code: 'DMS-SEED1',
      status: 'pending',
      source: 'online',
      start_at: manilaIso(addDays(todayManila, 2), 14),
      end_at: manilaIso(addDays(todayManila, 2), 16),
      total_amount: total2h,
      deposit_amount: deposit2h,
      amount_paid: 0,
      hold_expires_at: holdExpires,
      customer_name: 'Seed Band',
      customer_email: 'seed@example.com',
      customer_phone: '+639171234567',
      band_name: 'Seed Band',
      service_type_id: st.id,
    },
    {
      confirmation_code: 'DMS-SEED2',
      status: 'confirmed',
      source: 'online',
      start_at: manilaIso(addDays(todayManila, 5), 15),
      end_at: manilaIso(addDays(todayManila, 5), 17),
      total_amount: total2h,
      deposit_amount: deposit2h,
      amount_paid: deposit2h,
      hold_expires_at: null,
      customer_name: 'Seed Band',
      customer_email: 'seed@example.com',
      customer_phone: '+639171234567',
      band_name: 'Seed Band',
      service_type_id: st.id,
    },
    {
      confirmation_code: 'DMS-SEED3',
      status: 'completed',
      source: 'walk_in',
      start_at: manilaIso(addDays(todayManila, -1), 10),
      end_at: manilaIso(addDays(todayManila, -1), 12),
      total_amount: total2h,
      deposit_amount: deposit2h,
      amount_paid: total2h,
      hold_expires_at: null,
      customer_name: 'Seed Band',
      customer_email: 'seed@example.com',
      customer_phone: '+639171234567',
      band_name: 'Seed Band',
      service_type_id: st.id,
    },
  ]

  for (const booking of bookings) {
    const { error } = await supabase
      .from('bookings')
      .upsert(booking, { onConflict: 'confirmation_code' })

    if (error) {
      console.error(`Failed to upsert booking ${booking.confirmation_code}:`, error)
      process.exit(1)
    }

    console.log(`Upserted booking: ${booking.confirmation_code} (${booking.status})`)
  }

  console.log('Seed complete')
}

seed()
