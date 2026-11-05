'use client'

import { useState } from 'react'
import { retryBookingDelivery } from '@/lib/actions/admin/retryBookingDelivery'

export function BookingDeliveryActions({ bookingId, status }: { bookingId: string; status: string }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  if (status !== 'confirmed' && status !== 'cancelled') return null

  async function retry(channel: 'calendar' | 'email') {
    setBusy(true)
    setMessage('')
    try {
      const result = await retryBookingDelivery(bookingId, channel)
      setMessage(result.success ? (channel === 'email' ? 'Email sent.' : 'Calendar updated.') : result.error ?? 'Delivery failed.')
    } catch {
      setMessage('Unable to reach the server. Please retry.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="mt-2 flex max-w-xs flex-col items-start gap-2 text-xs">
    <button disabled={busy} onClick={() => retry('calendar')} className="min-h-10 underline disabled:opacity-50">{status === 'cancelled' ? 'Retry Calendar removal' : 'Sync Calendar'}</button>
    <button disabled={busy} onClick={() => retry('email')} className="min-h-10 underline disabled:opacity-50">{status === 'cancelled' ? 'Resend cancellation email' : 'Resend confirmation email'}</button>
    <p role="status">{busy ? 'Sending…' : message}</p>
  </div>
}
