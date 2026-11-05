import { createClient } from '@/lib/supabase/server'
import { BookingsCalendar, type BookingEvent } from '@/components/admin/BookingsCalendar'
import Link from 'next/link'

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
      'id, confirmation_code, band_name, customer_name, customer_phone, customer_email, start_at, end_at, status, deposit_amount, amount_paid, total_amount, source, payment_proof_url, series_id, booking_equipment(price_at_booking, equipment(name)), service_types(name)'
    )
    .neq('status', 'cancelled')
    .gte('end_at', `${from}T00:00:00+08:00`)
    .lte('start_at', `${to}T23:59:59+08:00`)
    .order('start_at')

  const events: BookingEvent[] = (bookings ?? []).map((b) => {
    const svc = b.service_types as { name: string } | { name: string }[] | null
    const serviceTypeName = (Array.isArray(svc) ? svc[0]?.name : svc?.name) ?? 'Rehearsal'
    return {
    id: b.id,
    confirmation_code: b.confirmation_code,
    title: b.band_name ?? b.customer_name,
    service_type_name: serviceTypeName,
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
    }
  })

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="mb-1 text-xs font-medium uppercase tracking-[0.16em] text-muted">Schedule</p>
          <h1 className="font-display text-3xl tracking-tight">Calendar</h1>
          <p className="mt-1 text-sm text-muted">Select a booking to review its details.</p></div>
        <div className="flex gap-2">
          <Link href="/admin/walk-in" className="rounded-lg border border-ink/15 bg-white px-4 py-2.5 text-sm font-medium hover:bg-ink/5">Walk-in</Link>
          <Link href="/admin/new-booking" className="rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-bg hover:opacity-85">+ New booking</Link>
        </div>
      </header>
      <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-xl border border-ink/10 bg-white px-4 py-3 text-xs text-muted" aria-label="Booking status legend">
        {([['#0B0B0C', 'Confirmed'], ['#fff', 'Pending'], ['#3D3D3D', 'Completed'], ['#E5E5E5', 'Cancelled']] as const).map(([color, label]) => <span key={label} className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm border border-ink/20" style={{ backgroundColor: color }} />{label}</span>)}
      </div>
      <div className="overflow-hidden rounded-xl border border-ink/10 bg-white p-3 sm:p-4">
        <BookingsCalendar bookings={events} from={from} to={to} />
      </div>
    </div>
  )
}
