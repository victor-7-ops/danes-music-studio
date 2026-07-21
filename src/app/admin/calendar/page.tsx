import { createClient } from '@/lib/supabase/server'
import { BookingsCalendar, type BookingEvent } from '@/components/admin/BookingsCalendar'

interface PageProps {
  searchParams: Promise<{ from?: string; to?: string }>
}

export default async function CalendarPage({ searchParams }: PageProps) {
  const params = await searchParams

  // Default to current month
  const now = new Date()
  const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split('T')[0]

  const from = params.from ?? defaultFrom
  const to = params.to ?? defaultTo

  const supabase = await createClient()

  const { data: bookings } = await supabase
    .from('bookings')
    .select(
      'id, confirmation_code, band_name, customer_name, customer_phone, customer_email, start_at, end_at, status, deposit_amount, amount_paid, total_amount, source, payment_proof_url, series_id, booking_equipment(price_at_booking, equipment(name))'
    )
    .neq('status', 'cancelled')
    .gte('end_at', `${from}T00:00:00+08:00`)
    .lte('start_at', `${to}T23:59:59+08:00`)
    .order('start_at')

  const events: BookingEvent[] = (bookings ?? []).map((b) => ({
    id: b.id,
    confirmation_code: b.confirmation_code,
    title: b.band_name ?? b.customer_name,
    start: new Date(b.start_at),
    end: new Date(b.end_at),
    status: b.status as BookingEvent['status'],
    customer_name: b.customer_name,
    customer_email: b.customer_email,
    customer_phone: b.customer_phone,
    band_name: b.band_name,
    deposit_amount: b.deposit_amount,
    amount_paid: b.amount_paid,
    total_amount: b.total_amount,
    source: b.source as BookingEvent['source'],
    payment_proof_url: b.payment_proof_url,
    series_id: b.series_id,
    equipment: (b.booking_equipment ?? []).map((be) => {
      const equip = be.equipment as { name: string } | { name: string }[] | null
      const name = Array.isArray(equip) ? equip[0]?.name : equip?.name
      return { name: name ?? 'Unknown', price: be.price_at_booking }
    }),
  }))

  return (
    <div className="p-6 h-screen">
      <h1 className="font-display text-3xl uppercase tracking-wide mb-6">Calendar</h1>
      <BookingsCalendar bookings={events} from={from} to={to} />
    </div>
  )
}
