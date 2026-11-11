import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatPHP } from '@/lib/emails/format'
import { BookingPaymentAction } from '@/components/admin/BookingPaymentAction'
import { BookingDeliveryActions } from '@/components/admin/BookingDeliveryActions'

const PAYMENT_LABEL: Record<string, string> = {
  full: 'Full payment',
  deposit: 'Deposit',
  none: 'Unpaid',
}
const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]
const STATUS_BADGE_CLASS: Record<string, string> = {
  pending: 'border border-amber-200 bg-amber-50 text-amber-900',
  confirmed: 'border border-emerald-200 bg-emerald-50 text-emerald-900',
  completed: 'border border-ink/10 bg-ink/5 text-ink/70',
  cancelled: 'border border-ink/10 bg-white text-ink/60',
}
interface SearchParams {
  status?: string
  from?: string
  to?: string
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const supabase = await createClient()
  let query = supabase
    .from('bookings')
    .select(
      'id, confirmation_code, band_name, customer_name, start_at, end_at, status, source, amount_paid, deposit_amount, total_amount, payment_method, payment_proof_url'
    )
    .order('start_at', { ascending: false })
  if (params.status) query = query.eq('status', params.status)
  if (params.from) query = query.gte('start_at', `${params.from}T00:00:00+08:00`)
  if (params.to) query = query.lte('start_at', `${params.to}T23:59:59+08:00`)
  const { data: bookings, error } = await query
  const filtered = Boolean(params.status || params.from || params.to)
  const inputClass =
    'min-h-11 w-full min-w-0 rounded-lg border border-ink/15 bg-white px-3 text-sm text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/10'

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.18em] text-ink/60">Studio operations</p>
          <h1 className="font-display text-4xl uppercase tracking-wide">Bookings</h1>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-ink/65">
            Review sessions, verify payments, and keep your studio schedule in sync.
          </p>
        </div>
        <Link
          href="/admin/new-booking"
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-ink px-4 text-sm font-medium text-bg transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          + New booking
        </Link>
      </header>

      <section
        aria-label="Filter bookings"
        className="rounded-2xl border border-ink/10 bg-white p-4 sm:p-5"
      >
        <form
          key={JSON.stringify([params.status, params.from, params.to])}
          method="GET"
          className="grid min-w-0 grid-cols-2 items-end gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
        >
          <label className="col-span-2 min-w-0 space-y-2 sm:col-span-1" htmlFor="status-filter">
            <span className="block text-xs font-medium text-ink/70">Booking status</span>
            <select
              id="status-filter"
              name="status"
              defaultValue={params.status ?? ''}
              className={inputClass}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0 space-y-2" htmlFor="from-filter">
            <span className="block text-xs font-medium text-ink/70">From date</span>
            <input
              id="from-filter"
              type="date"
              name="from"
              defaultValue={params.from ?? ''}
              className={inputClass}
            />
          </label>
          <label className="min-w-0 space-y-2" htmlFor="to-filter">
            <span className="block text-xs font-medium text-ink/70">To date</span>
            <input
              id="to-filter"
              type="date"
              name="to"
              defaultValue={params.to ?? ''}
              className={inputClass}
            />
          </label>
          <button
            type="submit"
            className="col-span-2 min-h-11 rounded-lg bg-ink px-5 text-sm font-medium text-bg transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink sm:col-span-1"
          >
            Apply filters
          </button>
        </form>
        {filtered && (
          <Link
            href="/admin/bookings"
            className="mt-2 inline-flex min-h-11 items-center text-sm text-ink/70 underline underline-offset-4 hover:text-ink"
          >
            Clear filters
          </Link>
        )}
      </section>

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-900"
        >
          Bookings could not be loaded. Clear the filters or refresh the page to try again.
        </div>
      ) : (
        <section aria-label="Booking results" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-ink">
              {filtered ? 'Filtered bookings' : 'All bookings'}{' '}
              <span className="ml-1 rounded-full bg-ink/5 px-2 py-0.5 text-xs tabular-nums text-ink/70">
                {bookings?.length ?? 0}
              </span>
            </h2>
            <p className="text-xs text-ink/60">Session times in Manila · Latest dates first</p>
          </div>
          {!bookings?.length ? (
            <div className="rounded-2xl border border-dashed border-ink/20 bg-white px-5 py-12 text-center">
              <h3 className="text-lg font-medium">
                {filtered ? 'No matching bookings' : 'Your bookings will appear here'}
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink/65">
                {filtered
                  ? 'Try a different status or date range to find a session.'
                  : 'Create a studio booking or wait for your first online reservation.'}
              </p>
              <Link
                href={filtered ? '/admin/bookings' : '/admin/new-booking'}
                className="mt-5 inline-flex min-h-11 items-center rounded-lg border border-ink/20 px-4 text-sm font-medium hover:bg-ink/5"
              >
                {filtered ? 'Clear all filters' : 'Create a booking'}
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {bookings.map((booking) => {
                const start = new Date(booking.start_at)
                const end = new Date(booking.end_at)
                const date = start.toLocaleDateString('en-PH', {
                  timeZone: 'Asia/Manila',
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
                const timeOptions: Intl.DateTimeFormatOptions = {
                  timeZone: 'Asia/Manila',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                }
                const time = `${start.toLocaleTimeString('en-PH', timeOptions)} – ${end.toLocaleTimeString('en-PH', timeOptions)}`
                return (
                  <article
                    key={booking.id}
                    aria-labelledby={`booking-${booking.id}`}
                    className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm"
                  >
                    <div className="flex-1 space-y-5 p-4 sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 basis-48">
                          <h3
                            id={`booking-${booking.id}`}
                            className="break-words text-lg font-semibold leading-snug text-ink"
                          >
                            {booking.band_name ?? booking.customer_name}
                          </h3>
                          {booking.band_name && (
                            <p className="mt-1 break-words text-sm text-ink/60">
                              {booking.customer_name}
                            </p>
                          )}
                          <p className="mt-2 text-sm font-medium text-ink">{date}</p>
                          <p className="mt-1 text-sm tabular-nums text-ink/65">{time}</p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium capitalize ${STATUS_BADGE_CLASS[booking.status] ?? 'text-ink'}`}
                        >
                          {booking.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-ink/65">
                        <span className="rounded-md bg-ink/5 px-2 py-1 capitalize">
                          {booking.source.replace('_', ' ')}
                        </span>
                        <span className="rounded-md bg-ink/5 px-2 py-1">
                          {PAYMENT_LABEL[booking.payment_method ?? 'none'] ??
                            booking.payment_method}
                        </span>
                      </div>
                      <dl className="grid grid-cols-2 gap-4 rounded-xl bg-[#f5f4f0] p-4 sm:grid-cols-4">
                        {[
                          { label: 'Total', amount: booking.total_amount },
                          { label: 'Paid', amount: booking.amount_paid },
                          { label: 'Deposit required', amount: booking.deposit_amount },
                          { label: 'Balance', amount: booking.total_amount - booking.amount_paid },
                        ].map(({ label, amount }) => (
                          <div key={label} className="min-w-0">
                            <dt className="text-xs text-ink/60">{label}</dt>
                            <dd className="mt-1 break-words text-base font-semibold tabular-nums text-ink">
                              {formatPHP(amount)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                      <div className="min-w-0">
                        <p className="text-xs text-ink/60">Booking reference</p>
                        <p className="mt-1 select-all break-all font-mono text-xs leading-relaxed text-ink/75">
                          {booking.confirmation_code}
                        </p>
                      </div>
                      <BookingPaymentAction
                        bookingId={booking.id}
                        status={booking.status}
                        paymentMethod={booking.payment_method}
                        depositAmount={booking.deposit_amount}
                        amountPaid={booking.amount_paid}
                        totalAmount={booking.total_amount}
                        source={booking.source}
                        hasPaymentProof={Boolean(booking.payment_proof_url)}
                      />
                    </div>
                    <BookingDeliveryActions bookingId={booking.id} status={booking.status} />
                  </article>
                )
              })}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
