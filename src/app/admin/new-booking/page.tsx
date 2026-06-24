'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { createOnsite } from '@/lib/actions/admin/createOnsite'

const inputClass = 'w-full border border-ink/30 bg-bg px-4 py-3 font-sans text-sm focus:outline-none focus:border-ink focus-visible:ring-2 focus-visible:ring-ink/30'
const labelClass = 'block font-sans text-sm uppercase tracking-widest mb-2'

export default function NewBookingPage() {
  const [date, setDate] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [bandName, setBandName] = useState('')
  const [depositReceived, setDepositReceived] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successCode, setSuccessCode] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function resetForm() {
    setDate('')
    setStart('')
    setEnd('')
    setCustomerName('')
    setCustomerPhone('')
    setCustomerEmail('')
    setBandName('')
    setDepositReceived(false)
    setError(null)
    setSuccessCode(null)
  }

  function handleSubmit() {
    if (!date || !start || !end) {
      setError('Please fill in date, start time, and end time.')
      return
    }
    if (!customerName.trim()) {
      setError('Customer name is required.')
      return
    }
    if (!customerPhone.trim()) {
      setError('Customer phone is required.')
      return
    }
    const [sh] = start.split(':').map(Number)
    const [eh] = end.split(':').map(Number)
    if (eh <= sh) {
      setError('End time must be after start time.')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await createOnsite({
        date,
        start,
        end,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim() || undefined,
        bandName: bandName.trim() || undefined,
        depositReceived,
      })
      if (result.success && result.code) {
        setSuccessCode(result.code)
      } else {
        setError(result.error ?? 'An error occurred.')
      }
    })
  }

  if (successCode) {
    return (
      <div className="min-h-screen bg-bg text-ink p-8 flex flex-col items-center justify-center">
        <div className="max-w-sm w-full text-center space-y-6">
          <h1 className="font-display text-3xl">Booking Created</h1>
          <p className="font-sans text-sm text-muted uppercase tracking-widest">Confirmation Code</p>
          <p className="font-display text-4xl tracking-widest" aria-live="polite">{successCode}</p>
          <p className="font-sans text-sm text-muted">
            Status: {depositReceived ? 'Confirmed' : 'Pending'}
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/admin/calendar"
              className="bg-ink text-bg px-6 py-3 font-sans text-xs uppercase tracking-widest hover:opacity-80 transition-opacity text-center"
            >
              View in Calendar
            </Link>
            <button
              onClick={resetForm}
              className="border border-ink text-ink px-6 py-3 font-sans text-xs uppercase tracking-widest hover:bg-ink hover:text-bg transition-colors"
            >
              New Booking
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg text-ink p-8">
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="font-display text-3xl">New Booking</h1>

        {/* Required field legend */}
        <p className="font-sans text-xs text-muted">
          Fields marked <span aria-hidden="true">*</span><span className="sr-only">with asterisk</span> are required.
        </p>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <label htmlFor="nb-date" className={labelClass}>
                Date <span aria-hidden="true" className="text-ink/40">*</span>
              </label>
              <input
                id="nb-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                aria-required="true"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="nb-start" className={labelClass}>
                Start <span aria-hidden="true" className="text-ink/40">*</span>
              </label>
              <input
                id="nb-start"
                type="time"
                step={3600}
                value={start}
                onChange={(e) => setStart(e.target.value)}
                required
                aria-required="true"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="nb-end" className={labelClass}>
                End <span aria-hidden="true" className="text-ink/40">*</span>
              </label>
              <input
                id="nb-end"
                type="time"
                step={3600}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                required
                aria-required="true"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="nb-customer-name" className={labelClass}>
              Customer Name <span aria-hidden="true" className="text-ink/40">*</span>
            </label>
            <input
              id="nb-customer-name"
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
              aria-required="true"
              autoComplete="name"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="nb-customer-phone" className={labelClass}>
              Customer Phone <span aria-hidden="true" className="text-ink/40">*</span>
            </label>
            <input
              id="nb-customer-phone"
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              required
              aria-required="true"
              autoComplete="tel"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="nb-customer-email" className={labelClass}>
              Customer Email
            </label>
            <input
              id="nb-customer-email"
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="Optional"
              autoComplete="email"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="nb-band-name" className={labelClass}>
              Band Name
            </label>
            <input
              id="nb-band-name"
              type="text"
              value={bandName}
              onChange={(e) => setBandName(e.target.value)}
              placeholder="Optional"
              className={inputClass}
            />
          </div>

          <div className="border border-ink/20 p-4 space-y-2">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="nb-deposit-received"
                checked={depositReceived}
                onChange={(e) => setDepositReceived(e.target.checked)}
                className="h-4 w-4 accent-ink"
              />
              <label htmlFor="nb-deposit-received" className="font-sans text-sm uppercase tracking-widest cursor-pointer">
                Deposit received
              </label>
            </div>
            <p className="font-sans text-xs text-muted pl-7" aria-live="polite">
              {depositReceived
                ? 'Status will be set to Confirmed'
                : 'Status will be set to Pending (owner-managed, no auto-expire)'}
            </p>
          </div>

          {error && (
            <p role="alert" className="text-red-600 font-sans text-sm">
              {error}
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="w-full bg-ink text-bg px-6 py-3 font-sans text-xs uppercase tracking-widest hover:opacity-80 transition-opacity disabled:opacity-50"
            aria-busy={isPending}
          >
            {isPending ? 'Creating...' : 'Create Booking'}
          </button>
        </div>
      </div>
    </div>
  )
}
