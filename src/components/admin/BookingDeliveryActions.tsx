'use client'

import { useState } from 'react'
import { retryBookingDelivery } from '@/lib/actions/admin/retryBookingDelivery'

export function BookingDeliveryActions({
  bookingId,
  status,
}: {
  bookingId: string
  status: string
}) {
  const [busy, setBusy] = useState<'calendar' | 'email' | null>(null)
  const [result, setResult] = useState<{ success: boolean; text: string } | null>(null)
  if (status !== 'confirmed' && status !== 'cancelled') return null

  async function retry(channel: 'calendar' | 'email') {
    setBusy(channel)
    setResult(null)
    try {
      const response = await retryBookingDelivery(bookingId, channel)
      setResult({
        success: response.success,
        text: response.success
          ? channel === 'email'
            ? 'Email sent.'
            : 'Calendar updated.'
          : (response.error ?? 'Delivery failed.'),
      })
    } catch {
      setResult({ success: false, text: 'Unable to reach the server. Please retry.' })
    } finally {
      setBusy(null)
    }
  }

  const buttonClass =
    'min-h-11 rounded-lg border border-ink/15 bg-white px-3 py-2 text-left text-sm font-medium text-ink transition-colors hover:bg-ink/5 disabled:cursor-wait disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

  return (
    <details className="border-t border-ink/10 bg-[#fafaf8] px-4 sm:px-5">
      <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-ink/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink">
        Calendar &amp; email
      </summary>
      <div className="space-y-3 pb-4">
        <p className="text-xs leading-relaxed text-ink/65">
          Use these controls if a Calendar update or booking email needs to be sent again.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => retry('calendar')}
            className={buttonClass}
          >
            {busy === 'calendar'
              ? 'Updating Calendar…'
              : status === 'cancelled'
                ? 'Retry Calendar removal'
                : 'Sync Calendar'}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => retry('email')}
            className={buttonClass}
          >
            {busy === 'email'
              ? 'Sending email…'
              : status === 'cancelled'
                ? 'Resend cancellation email'
                : 'Resend confirmation email'}
          </button>
        </div>
        {busy && (
          <p role="status" className="text-xs text-ink/65">
            {busy === 'email' ? 'Sending email…' : 'Updating Calendar…'}
          </p>
        )}
        {result && (
          <p
            role={result.success ? 'status' : 'alert'}
            className={`rounded-lg px-3 py-2 text-sm ${result.success ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-900'}`}
          >
            {result.text}
          </p>
        )}
      </div>
    </details>
  )
}
