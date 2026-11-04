import { redirect } from 'next/navigation'
import Image from 'next/image'
import { createServiceClient } from '@/lib/supabase/serviceClient'
import { DmsHero } from '@/components/DmsHero'
import { PaymentProofUpload } from '@/components/booking/PaymentProofUpload'
import { formatPHP } from '@/lib/emails/format'

interface PageProps {
  searchParams: Promise<{ code?: string; token?: string }>
}

// PayMongo is off — manual QR + proof upload is the only active payment path.
// src/lib/paymongo.ts and the webhook route are left in place, unwired, for
// future re-enablement (see HANDOFF.md).
export default async function PayPage({ searchParams }: PageProps) {
  const params = await searchParams
  const code = params.code
  const token = params.token

  if (!code) {
    redirect('/book')
  }
  if (!token) return <RecoveryPage />

  const supabase = createServiceClient()
  const [bookingResult, settingsResult] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, status, hold_expires_at, deposit_amount, total_amount, payment_method, confirmation_code, payment_proof_url')
      .eq('confirmation_code', code)
      .eq('cancel_token', token)
      .single(),
    supabase.from('settings').select('gcash_qr_url, bank_details, bank_name, account_name, account_number').single(),
  ])

  const { data: booking } = bookingResult
  const { data: settings } = settingsResult

  if (!booking) {
    redirect('/book')
  }

  if (booking.status !== 'pending') {
    redirect(`/book/confirm?code=${code}&token=${token}`)
  }

  if (booking.hold_expires_at && booking.hold_expires_at < new Date().toISOString()) {
    redirect('/book')
  }

  if (booking.payment_proof_url) {
    redirect(`/book/confirm?code=${code}&token=${token}`)
  }

  const amountCentavos = booking.payment_method === 'deposit'
    ? booking.deposit_amount
    : booking.total_amount

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-8">
        <DmsHero dark />
      </div>

      <h1 className="font-display text-4xl uppercase text-ink mb-2">
        Pay {formatPHP(amountCentavos)}
      </h1>
      <p className="font-sans text-sm text-muted mb-8">
        {booking.confirmation_code}
      </p>

  {!settings?.gcash_qr_url && !settings?.bank_details && !settings?.bank_name && !settings?.account_number ? (
        <p className="font-sans text-muted mb-8 max-w-sm">
          Payment not configured — contact the studio to arrange payment.
        </p>
      ) : (
        <>
          {settings.gcash_qr_url && (
            <div className="mb-8">
              <Image
                src={settings.gcash_qr_url}
                alt="GCash QR code"
                width={280}
                height={280}
                className="mx-auto"
              />
            </div>
          )}

          {settings.bank_name || settings.account_name || settings.account_number ? (
            <p className="font-sans text-sm text-muted mb-8 max-w-sm whitespace-pre-line">
              {[settings.bank_name, settings.account_name, settings.account_number].filter(Boolean).join('\n')}
            </p>
          ) : settings.bank_details ? (
            <p className="font-sans text-sm text-muted mb-8 max-w-sm whitespace-pre-line">
              {settings.bank_details}
            </p>
          ) : null}

          <p className="font-sans text-sm text-ink mb-6 max-w-sm">
            Scan the QR or transfer to the account above, then upload a screenshot of your payment.
          </p>

          <PaymentProofUpload confirmationCode={booking.confirmation_code} token={token} />
        </>
      )}
    </div>
  )
}

function RecoveryPage() {
  return <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 py-16 text-center"><DmsHero dark /><h1 className="font-display text-4xl uppercase text-ink mb-4">Manage link required</h1><p className="font-sans text-sm text-muted max-w-sm">Use the private payment link from your booking email. If you no longer have it, contact the studio and include your booking reference.</p><a href="mailto:danesmusicstudio@gmail.com" className="mt-6 underline">Contact the studio</a></div>
}
