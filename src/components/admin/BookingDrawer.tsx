'use client'

import { useState } from 'react'
import { BookingEvent } from '@/components/admin/BookingsCalendar'
import { confirmDeposit } from '@/lib/actions/admin/confirmDeposit'
import { cancelBooking } from '@/lib/actions/admin/cancelBooking'
import { formatPHP } from '@/lib/emails/format'

interface BookingDrawerProps {
  booking: BookingEvent
  onClose: () => void
  onMutated: () => void
}

function formatManilaDate(date: Date): string {
  return date.toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatManilaTime(date: Date): string {
  return date.toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

const STATUS_BADGE: Record<
  BookingEvent['status'],
  { bg: string; text: string }
> = {
  confirmed: { bg: 'bg-ink', text: 'text-bg' },
  pending: { bg: 'bg-transparent border border-muted', text: 'text-ink' },
  completed: { bg: 'bg-[#3D3D3D]', text: 'text-bg' },
  cancelled: { bg: 'bg-[#E5E5E5]', text: 'text-[#9A9A9A]' },
}

export function BookingDrawer({ booking, onClose, onMutated }: BookingDrawerProps) {
  // amounts stored as centavos; display as pesos in input
  const [amountReceived, setAmountReceived] = useState<number>(
    booking.deposit_amount / 100
  )
  const [cancelConfirmStep, setCancelConfirmStep] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const badge = STATUS_BADGE[booking.status]

  async function handleConfirmDeposit() {
    setLoading(true)
    setError(null)
    // multiply by 100 to convert pesos → centavos for the server action
    const result = await confirmDeposit(booking.id, Math.round(amountReceived * 100))
    setLoading(false)
    if (result.success) {
      onMutated()
    } else {
      setError(result.error ?? 'Failed to confirm deposit.')
    }
  }

  async function handleCancelBooking() {
    setLoading(true)
    setError(null)
    const result = await cancelBooking(booking.id)
    setLoading(false)
    if (result.success) {
      onMutated()
    } else {
      setError(result.error ?? 'Failed to cancel booking.')
    }
  }

  const canCancel =
    booking.status === 'pending' || booking.status === 'confirmed'

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-bg shadow-xl z-50 p-6 overflow-y-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="font-display text-2xl uppercase tracking-wide text-ink">
              {booking.confirmation_code}
            </p>
            <p className="text-xs uppercase tracking-widest text-muted mt-1">
              {booking.source.replace('_', ' ')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-ink transition-colors text-xl leading-none"
            aria-label="Close drawer"
          >
            ×
          </button>
        </div>

        {/* Status badge */}
        <div>
          <span
            className={`inline-block px-3 py-1 text-xs uppercase tracking-widest font-sans ${badge.bg} ${badge.text}`}
          >
            {booking.status}
          </span>
        </div>

        {/* Date / time */}
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-widest text-muted font-sans">Date &amp; Time</p>
          <p className="text-ink font-sans">
            {formatManilaDate(booking.start)}
          </p>
          <p className="text-ink font-sans">
            {formatManilaTime(booking.start)} – {formatManilaTime(booking.end)}
          </p>
        </div>

        {/* Band / Customer */}
        <div className="space-y-3">
          {booking.band_name && (
            <div>
              <p className="text-xs uppercase tracking-widest text-muted font-sans">Band</p>
              <p className="text-ink font-sans">{booking.band_name}</p>
            </div>
          )}
          <div>
            <p className="text-xs uppercase tracking-widest text-muted font-sans">Customer</p>
            <p className="text-ink font-sans">{booking.customer_name}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted font-sans">Phone</p>
            <p className="text-ink font-sans">{booking.customer_phone}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted font-sans">Email</p>
            <p className="text-ink font-sans">{booking.customer_email}</p>
          </div>
        </div>

        {/* Money */}
        <div className="border-t border-muted pt-4 space-y-2">
          <div className="flex justify-between font-sans text-sm">
            <span className="text-muted uppercase tracking-widest">Deposit</span>
            <span className="text-ink">{formatPHP(booking.deposit_amount)}</span>
          </div>
          <div className="flex justify-between font-sans text-sm">
            <span className="text-muted uppercase tracking-widest">Paid</span>
            <span className="text-ink">{formatPHP(booking.amount_paid)}</span>
          </div>
          <div className="flex justify-between font-sans text-sm font-semibold">
            <span className="text-muted uppercase tracking-widest">Total</span>
            <span className="text-ink">{formatPHP(booking.total_amount)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 mt-auto">
          {/* Confirm deposit form — only for pending bookings */}
          {booking.status === 'pending' && (
            <div className="space-y-2">
              <label
                htmlFor="amount-received"
                className="block text-xs uppercase tracking-widest text-muted font-sans"
              >
                Amount received (₱)
              </label>
              <input
                id="amount-received"
                type="number"
                min={0}
                step={0.01}
                value={amountReceived}
                onChange={(e) =>
                  setAmountReceived(parseFloat(e.target.value) || 0)
                }
                className="w-full border border-muted px-3 py-2 text-ink bg-bg font-sans focus:outline-none focus:border-ink"
                disabled={loading}
              />
              <button
                onClick={handleConfirmDeposit}
                disabled={loading}
                className="w-full bg-ink text-bg px-6 py-3 hover:opacity-80 transition-opacity uppercase tracking-widest font-sans text-sm disabled:opacity-50"
              >
                {loading ? 'Confirming…' : 'Confirm Deposit'}
              </button>
            </div>
          )}

          {/* Cancel button */}
          {canCancel && !cancelConfirmStep && (
            <button
              onClick={() => setCancelConfirmStep(true)}
              disabled={loading}
              className="w-full border border-muted text-ink px-6 py-3 hover:bg-[#E5E5E5] transition-colors uppercase tracking-widest font-sans text-sm disabled:opacity-50"
            >
              Cancel Booking
            </button>
          )}

          {/* Cancel confirmation step */}
          {cancelConfirmStep && (
            <div className="space-y-2">
              <p className="text-sm text-ink font-sans">Cancel this booking?</p>
              <div className="flex gap-2">
                <button
                  onClick={handleCancelBooking}
                  disabled={loading}
                  className="flex-1 bg-ink text-bg px-4 py-2 hover:opacity-80 transition-opacity uppercase tracking-widest font-sans text-sm disabled:opacity-50"
                >
                  {loading ? 'Cancelling…' : 'Yes, cancel'}
                </button>
                <button
                  onClick={() => setCancelConfirmStep(false)}
                  disabled={loading}
                  className="flex-1 border border-muted text-ink px-4 py-2 hover:bg-[#E5E5E5] transition-colors uppercase tracking-widest font-sans text-sm disabled:opacity-50"
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <p className="text-sm text-red-600 font-sans">{error}</p>
          )}
        </div>
      </div>
    </>
  )
}
