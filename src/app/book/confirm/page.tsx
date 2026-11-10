import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/serviceClient'
import { DmsHero } from '@/components/DmsHero'
import { formatManila, formatPHP } from '@/lib/emails/format'

interface PageProps {
  searchParams: Promise<{
    code?: string
    token?: string
    payment?: string
  }>
}

export default async function ConfirmPage({ searchParams }: PageProps) {
  const params = await searchParams
  const code = params.code
  const token = params.token
  const payment = params.payment

  if (!code) {
    redirect('/book')
  }

  if (!token) return <RecoveryPage />
  const supabase = createServiceClient()
  const { data: booking } = await supabase
    .from('bookings')
    .select('status, confirmation_code, hold_expires_at, total_amount, deposit_amount, payment_method, start_at, end_at, band_name, customer_name, payment_proof_url, voucher_code_snapshot, voucher_discount_centavos')
    .eq('confirmation_code', code)
    .eq('cancel_token', token)
    .single()

  if (!booking) return <RecoveryPage />

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

        {booking.voucher_code_snapshot && booking.voucher_discount_centavos > 0 && (
          <p className="font-sans text-sm text-muted mb-4">
            Voucher {booking.voucher_code_snapshot} applied: -{formatPHP(booking.voucher_discount_centavos)}
          </p>
        )}

        {booking.total_amount === 0 && booking.payment_method === 'none' ? (
          <p className="font-sans text-sm text-ink mb-8">No payment required.</p>
        ) : null}

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

  if (booking.status === 'cancelled' || booking.status === 'completed' || (booking.hold_expires_at && booking.hold_expires_at < new Date().toISOString())) {
    const statusLabel = booking.status === 'completed' ? 'Booking completed' : booking.status === 'cancelled' ? 'Booking cancelled' : 'Booking hold expired'
    return <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 py-16 text-center"><DmsHero dark /><h1 className="font-display text-4xl uppercase text-ink mb-4">{statusLabel}</h1><p className="font-sans text-sm text-muted max-w-sm">This booking is no longer awaiting payment. Contact the studio if you need help.</p><Link href="mailto:danesmusicstudio@gmail.com" className="mt-6 underline">Contact the studio</Link></div>
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
          href={`/book/pay?code=${code}&token=${token}`}
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

  // Branch B2 — pending with proof already uploaded, awaiting admin review
  if (booking.payment_proof_url) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-8">
          <DmsHero dark />
        </div>

        <h1 className="font-display text-6xl uppercase text-ink mb-4">
          Proof Submitted
        </h1>

        <p className="font-sans text-muted mb-8 max-w-sm">
          We&apos;re reviewing your payment. You&apos;ll get a confirmation email once it&apos;s verified.
        </p>

        <div className="font-display text-4xl text-ink tracking-widest mb-8">
          {booking.confirmation_code}
        </div>

        <Link href="/" className="font-sans text-sm text-muted underline">
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
        {booking.hold_expires_at ? <>Complete payment before {formatManila(booking.hold_expires_at, 'datetime')} to confirm your booking.</> : 'Your booking is awaiting studio review.'}
      </p>

      <Link
        href={`/book/pay?code=${code}&token=${token}`}
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

function RecoveryPage() {
  return <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 py-16 text-center"><DmsHero dark /><h1 className="font-display text-4xl uppercase text-ink mb-4">Private link required</h1><p className="font-sans text-sm text-muted max-w-sm">Open the private manage link from your booking email. If you no longer have it, contact the studio with your booking reference.</p><Link href="mailto:danesmusicstudio@gmail.com" className="mt-6 underline">Contact the studio</Link></div>
}
