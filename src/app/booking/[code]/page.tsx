import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/serviceClient'
import { formatPHP, formatManila } from '@/lib/emails/format'
import { DmsHero } from '@/components/DmsHero'

// createServiceClient() doesn't call cookies()/headers(), so Next has no
// signal to opt this route out of static/fetch caching — without this it
// serves stale booking status after cancel/reschedule/confirm.
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ code: string }>
  searchParams: Promise<{ token?: string; cancelled?: string; error?: string }>
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid_link: 'That link is invalid or has expired.',
  already_cancelled: 'This booking is already cancelled.',
  past_booking: 'This booking has already started or finished — contact the studio to make changes.',
}

export default async function ManageBookingPage({ params, searchParams }: PageProps) {
  const { code } = await params
  const { token, cancelled, error } = await searchParams

  const notFound = (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-8">
        <DmsHero dark />
      </div>
      <h1 className="font-display text-4xl uppercase text-ink mb-4">Booking Not Found</h1>
      <p className="font-sans text-muted mb-8">
        Check the link from your confirmation email, or contact the studio.
      </p>
      <Link href="/" className="font-sans text-sm text-muted underline">
        Back to home
      </Link>
    </div>
  )

  if (!token) return notFound

  const supabase = createServiceClient()
  const { data: booking } = await supabase
    .from('bookings')
    .select('confirmation_code, band_name, customer_name, start_at, end_at, status, total_amount, deposit_amount, amount_paid, payment_method')
    .eq('confirmation_code', code.toUpperCase())
    .eq('cancel_token', token)
    .single()

  if (!booking) return notFound

  const canModify = booking.status !== 'cancelled' && new Date(booking.start_at) > new Date()

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-8">
        <DmsHero dark />
      </div>

      <h1 className="font-display text-4xl uppercase text-ink mb-2">{booking.band_name ?? booking.customer_name}</h1>
      <p className="font-sans text-sm text-muted mb-8">{booking.confirmation_code}</p>

      {cancelled === '1' && (
        <p className="font-sans text-sm text-ink border-l-2 border-ink/20 pl-3 mb-6 max-w-sm">
          Booking cancelled.
        </p>
      )}
      {error && ERROR_MESSAGES[error] && (
        <p className="font-sans text-sm text-red-600 border-l-2 border-red-600/30 pl-3 mb-6 max-w-sm">
          {ERROR_MESSAGES[error]}
        </p>
      )}

      <div className="w-full max-w-sm text-left space-y-3 mb-10 font-sans text-sm">
        <div className="flex justify-between">
          <span className="text-muted uppercase tracking-widest text-xs">Status</span>
          <span className="text-ink capitalize">{booking.status}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted uppercase tracking-widest text-xs">Date</span>
          <span className="text-ink">{formatManila(booking.start_at, 'date')}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted uppercase tracking-widest text-xs">Time</span>
          <span className="text-ink">
            {formatManila(booking.start_at, 'time')} – {formatManila(booking.end_at, 'time')}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted uppercase tracking-widest text-xs">Total</span>
          <span className="text-ink tabular-nums">{formatPHP(booking.total_amount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted uppercase tracking-widest text-xs">Paid</span>
          <span className="text-ink tabular-nums">{formatPHP(booking.amount_paid)}</span>
        </div>
      </div>

      {canModify && (
        <div className="flex flex-col gap-3 w-full max-w-sm">
          <Link
            href={`/booking/${booking.confirmation_code}/reschedule-confirm?token=${token}`}
            className="bg-ink text-bg px-6 py-3 font-sans text-sm uppercase tracking-widest hover:opacity-80 transition-opacity"
          >
            Reschedule
          </Link>
          <Link
            href={`/booking/${booking.confirmation_code}/cancel-confirm?token=${token}`}
            className="border border-ink/20 text-ink px-6 py-3 font-sans text-sm uppercase tracking-widest hover:bg-ink/5 transition-colors"
          >
            Cancel Booking
          </Link>
        </div>
      )}

      <Link href="/" className="font-sans text-sm text-muted underline mt-8">
        Back to home
      </Link>
    </div>
  )
}
