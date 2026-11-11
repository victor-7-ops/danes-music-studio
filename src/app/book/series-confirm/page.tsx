import { redirect } from 'next/navigation'
import Link from 'next/link'
import { DmsHero } from '@/components/DmsHero'
import { createServiceClient } from '@/lib/supabase/serviceClient'
import { formatManila } from '@/lib/emails/format'
import { formatPHP } from '@/lib/emails/format'

interface PageProps {
  searchParams: Promise<{
    codes?: string
    tokens?: string
  }>
}

// Lightweight summary shown after a recurring series is created (Option B —
// per-occurrence payment, plan 031). Unlike the single-booking /book/confirm
// page, N confirmation codes now exist instead of one, so this doesn't try
// to shoehorn them through the existing single-code book/pay?code=... URL
// shape — each code links to the existing, unmodified /book/pay flow.
export default async function SeriesConfirmPage({ searchParams }: PageProps) {
  const params = await searchParams
  const codesParam = params.codes
  const tokensParam = params.tokens

  if (!codesParam || !tokensParam) {
    redirect('/book')
  }

  const codes = codesParam.split(',').filter(Boolean)
  const tokens = tokensParam.split(',').filter(Boolean)

  if (codes.length === 0 || codes.length !== tokens.length || codes.length > 26) {
    redirect('/book')
  }

  const service = createServiceClient()
  const { data: records } = await service.from('bookings').select('confirmation_code, cancel_token, start_at, status, hold_expires_at, payment_proof_url, payment_method, total_amount, deposit_amount, voucher_code_snapshot, voucher_discount_centavos').in('confirmation_code', codes)
  const sessions = codes.map((code, i) => records?.find(row => row.confirmation_code === code && row.cancel_token === tokens[i]))
  if (sessions.some(session => !session)) redirect('/book')
  const deadline = sessions.find(session => session?.hold_expires_at)?.hold_expires_at ?? null
  const now = new Date().toISOString()

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-8">
        <DmsHero dark />
      </div>

      <h1 className="font-display text-6xl uppercase text-ink mb-4">
        Series Booked
      </h1>

      <p className="font-sans text-muted mb-8 max-w-md">
        Submit each session&apos;s required payment by the initial hold deadline{deadline ? `, ${formatManila(deadline, 'datetime')}` : ''}. The studio confirms each session after reviewing its proof.
      </p>

      <div className="w-full max-w-sm border border-border divide-y divide-border mb-10 text-left">
        {codes.map((code, i) => (
          <div key={code} className="flex justify-between items-center px-4 py-3">
            <span className="font-sans text-xs uppercase tracking-widest text-muted">
              Week {i + 1}
            </span>
            <div className="flex flex-col items-end">
            <span className="font-sans text-xs text-muted">{formatManila(sessions[i]!.start_at, 'date')} · {sessions[i]!.status}</span>
            <span className="font-sans text-xs text-muted">
              {sessions[i]!.total_amount === 0 ? 'No payment required' : `${formatPHP(sessions[i]!.payment_method === 'deposit' ? sessions[i]!.deposit_amount : sessions[i]!.total_amount)} due`}
            </span>
            {sessions[i]!.voucher_code_snapshot && sessions[i]!.voucher_discount_centavos > 0 && (
              <span className="font-sans text-xs text-muted">
                Voucher {sessions[i]!.voucher_code_snapshot}: -{formatPHP(sessions[i]!.voucher_discount_centavos)}
              </span>
            )}
            {sessions[i]!.status === 'pending' && !sessions[i]!.payment_proof_url && (!sessions[i]!.hold_expires_at || sessions[i]!.hold_expires_at > now) ? <Link
              href={`/book/pay?code=${code}&token=${tokens[i]}`}
              className="font-display text-lg text-ink tracking-widest hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
            >
              {code}
            </Link>
            : <span className="font-sans text-xs text-muted">{sessions[i]!.status === 'confirmed' ? 'Confirmed' : sessions[i]!.payment_proof_url ? 'Proof submitted' : sessions[i]!.status === 'pending' ? 'Hold expired' : 'Unavailable'}</span>}
            </div>
          </div>
        ))}
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
