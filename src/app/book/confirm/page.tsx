import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { DmsHero } from '@/components/DmsHero'

interface PageProps {
  searchParams: Promise<{
    code?: string
    payment?: string
  }>
}

export default async function ConfirmPage({ searchParams }: PageProps) {
  const params = await searchParams
  const code = params.code
  const payment = params.payment

  if (!code) {
    redirect('/book')
  }

  const supabase = await createClient()
  const { data: booking } = await supabase
    .from('bookings')
    .select('status, confirmation_code, hold_expires_at, total_amount, deposit_amount, payment_method, start_at, end_at, band_name, customer_name')
    .eq('confirmation_code', code)
    .single()

  if (!booking) {
    redirect('/book')
  }

  // Branch A — confirmed
  if (booking.status === 'confirmed') {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-8">
          <DmsHero dark />
        </div>

        <h1 className="font-display text-6xl uppercase text-ink mb-4">
          Booking Confirmed
        </h1>

        <p className="font-sans text-muted mb-8">
          Your slot is locked in. See you at the studio.
        </p>

        <div className="font-display text-4xl text-ink tracking-widest mb-8">
          {booking.confirmation_code}
        </div>

        <Link
          href="/"
          className="font-sans text-sm text-muted underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
        >
          Back to home
        </Link>
      </div>
    )
  }

  // Branch B — payment cancelled
  if (payment === 'cancelled') {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-8">
          <DmsHero dark />
        </div>

        <h1 className="font-display text-6xl uppercase text-ink mb-4">
          Payment Cancelled
        </h1>

        <p className="font-sans text-muted mb-8">
          Your slot is still held. Try again before time runs out.
        </p>

        <div className="font-display text-4xl text-ink tracking-widest mb-8">
          {booking.confirmation_code}
        </div>

        <Link
          href={`/book/pay?code=${code}`}
          className="font-sans text-sm uppercase tracking-widest bg-ink text-bg px-6 py-3 hover:opacity-80 transition-opacity motion-reduce:transition-none mb-6 inline-block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
        >
          Try Payment Again
        </Link>

        <Link
          href="/"
          className="font-sans text-sm text-muted underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
        >
          Back to home
        </Link>
      </div>
    )
  }

  // Branch C — pending (existing "You're In." JSX preserved)
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-8">
        <DmsHero dark />
      </div>

      <h1 className="font-display text-6xl uppercase text-ink mb-4">
        You&apos;re In.
      </h1>

      <p className="font-sans text-muted mb-8">
        Your rehearsal slot is reserved.
      </p>

      <div className="font-display text-4xl text-ink tracking-widest mb-8">
        {code}
      </div>

      <p className="font-sans text-sm text-muted mb-10 max-w-sm">
        We&apos;ve held your slot for 15 minutes. Complete payment to confirm your booking.
      </p>

      <Link
        href={`/book/pay?code=${code}`}
        className="font-sans text-sm uppercase tracking-widest bg-ink text-bg px-6 py-3 hover:opacity-80 transition-opacity motion-reduce:transition-none mb-6 inline-block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
      >
        Continue to Payment →
      </Link>

      <Link
        href="/"
        className="font-sans text-sm text-muted underline"
      >
        Back to home
      </Link>
    </div>
  )
}
