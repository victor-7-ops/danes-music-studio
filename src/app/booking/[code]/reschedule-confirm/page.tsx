import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/serviceClient'
import { formatManila } from '@/lib/emails/format'
import { DmsHero } from '@/components/DmsHero'

// Same caching rationale as src/app/booking/[code]/page.tsx.
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ code: string }>
  searchParams: Promise<{ token?: string }>
}

export default async function RescheduleConfirmPage({ params, searchParams }: PageProps) {
  const { code } = await params
  const { token } = await searchParams

  if (!token) {
    redirect('/book?error=invalid_link')
  }

  const supabase = createServiceClient()
  const { data: booking } = await supabase
    .from('bookings')
    .select('confirmation_code, band_name, customer_name, status, start_at')
    .eq('confirmation_code', code.toUpperCase())
    .eq('cancel_token', token)
    .single()

  if (!booking) {
    redirect('/book?error=invalid_link')
  }

  if (booking.status === 'cancelled') {
    redirect(`/booking/${booking.confirmation_code}?token=${token}&error=already_cancelled`)
  }

  if (new Date(booking.start_at) <= new Date()) {
    redirect(`/booking/${booking.confirmation_code}?token=${token}&error=past_booking`)
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-8">
        <DmsHero dark />
      </div>

      <h1 className="font-display text-4xl uppercase text-ink mb-2">{booking.band_name ?? booking.customer_name}</h1>
      <p className="font-sans text-sm text-muted mb-8">{booking.confirmation_code}</p>

      <div className="w-full max-w-sm text-left space-y-3 mb-10 font-sans text-sm">
        <div className="flex justify-between">
          <span className="text-muted uppercase tracking-widest text-xs">Date</span>
          <span className="text-ink">{formatManila(booking.start_at, 'date')}</span>
        </div>
      </div>

      <p className="font-sans text-sm text-ink border-l-2 border-ink/20 pl-3 mb-6 max-w-sm">
        Rescheduling cancels this booking and takes you to make a new one. Confirm to continue.
      </p>

      <form action="/api/booking/reschedule" method="POST" className="flex flex-col gap-3 w-full max-w-sm">
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          className="bg-ink text-bg px-6 py-3 font-sans text-sm uppercase tracking-widest hover:opacity-80 transition-opacity"
        >
          Confirm Reschedule
        </button>
        <Link
          href={`/booking/${booking.confirmation_code}?token=${token}`}
          className="border border-ink/20 text-ink px-6 py-3 font-sans text-sm uppercase tracking-widest hover:bg-ink/5 transition-colors"
        >
          Go Back
        </Link>
      </form>

      <Link href="/" className="font-sans text-sm text-muted underline mt-8">
        Back to home
      </Link>
    </div>
  )
}
