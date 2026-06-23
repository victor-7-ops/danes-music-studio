import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createCheckoutSession } from '@/lib/paymongo'
import { DmsHero } from '@/components/DmsHero'

interface PageProps {
  searchParams: Promise<{ code?: string }>
}

export default async function PayPage({ searchParams }: PageProps) {
  const params = await searchParams
  const code = params.code

  if (!code) {
    redirect('/book')
  }

  if (!process.env.PAYMONGO_SECRET_KEY) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-8">
          <DmsHero />
        </div>
        <h1 className="font-display text-4xl uppercase text-ink mb-4">
          Payment Not Configured
        </h1>
        <p className="font-sans text-muted">
          Payment not configured — contact the studio.
        </p>
      </div>
    )
  }

  const supabase = await createClient()
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('id, status, hold_expires_at, deposit_amount, total_amount, payment_method, confirmation_code')
    .eq('confirmation_code', code)
    .single()

  if (error || !booking) {
    redirect('/book')
  }

  if (booking.status !== 'pending') {
    redirect('/book')
  }

  if (booking.hold_expires_at && booking.hold_expires_at < new Date().toISOString()) {
    redirect('/book')
  }

  const amountCentavos = booking.payment_method === 'deposit'
    ? booking.deposit_amount
    : booking.total_amount

  const base = process.env.NEXT_PUBLIC_URL ?? 'http://localhost:3000'
  const successUrl = `${base}/book/confirm?code=${code}`
  const cancelUrl = `${base}/book/confirm?code=${code}&payment=cancelled`

  let checkoutUrl: string | null = null
  try {
    checkoutUrl = await createCheckoutSession({
      amount: amountCentavos,
      description: 'DMS Rehearsal — ' + code,
      referenceNumber: code,
      successUrl,
      cancelUrl,
    })
  } catch {
    // API error — checkoutUrl remains null
  }

  if (!checkoutUrl) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-8">
          <DmsHero />
        </div>
        <h1 className="font-display text-4xl uppercase text-ink mb-4">
          Payment Error
        </h1>
        <p className="font-sans text-muted mb-8">
          Payment session could not be created. Please try again or contact the studio.
        </p>
        <Link
          href={`/book/pay?code=${code}`}
          className="font-sans text-sm uppercase tracking-widest bg-ink text-bg px-6 py-3 hover:opacity-80 transition-opacity inline-block"
        >
          Try Again
        </Link>
      </div>
    )
  }

  redirect(checkoutUrl)
}
