'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { createOnsite } from '@/lib/actions/admin/createOnsite'

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
      setError('Please fill in date, start, and end time.')
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
          <p className="font-display text-4xl tracking-widest">{successCode}</p>
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

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <label className="block font-sans text-sm uppercase tracking-widest mb-2">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-ink/30 bg-bg px-4 py-3 font-sans text-sm focus:outline-none focus:border-ink"
              />
            </div>
            <div>
              <label className="block font-sans text-sm uppercase tracking-widest mb-2">Start</label>
              <input
                type="time"
                step={3600}
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-full border border-ink/30 bg-bg px-4 py-3 font-sans text-sm focus:outline-none focus:border-ink"
              />
            </div>
            <div>
              <label className="block font-sans text-sm uppercase tracking-widest mb-2">End</label>
              <input
                type="time"
                step={3600}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="w-full border border-ink/30 bg-bg px-4 py-3 font-sans text-sm focus:outline-none focus:border-ink"
              />
            </div>
          </div>

          <div>
            <label className="block font-sans text-sm uppercase tracking-widest mb-2">Customer Name</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
              className="w-full border border-ink/30 bg-bg px-4 py-3 font-sans text-sm focus:outline-none focus:border-ink"
            />
          </div>

          <div>
            <label className="block font-sans text-sm uppercase tracking-widest mb-2">Customer Phone</label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              required
              className="w-full border border-ink/30 bg-bg px-4 py-3 font-sans text-sm focus:outline-none focus:border-ink"
            />
          </div>

          <div>
            <label className="block font-sans text-sm uppercase tracking-widest mb-2">Customer Email</label>
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="Email (optional)"
              className="w-full border border-ink/30 bg-bg px-4 py-3 font-sans text-sm focus:outline-none focus:border-ink"
            />
          </div>

          <div>
            <label className="block font-sans text-sm uppercase tracking-widest mb-2">Band Name</label>
            <input
              type="text"
              value={bandName}
              onChange={(e) => setBandName(e.target.value)}
              placeholder="Band name (optional)"
              className="w-full border border-ink/30 bg-bg px-4 py-3 font-sans text-sm focus:outline-none focus:border-ink"
            />
          </div>

          <div className="border border-ink/20 p-4 space-y-2">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="depositReceived"
                checked={depositReceived}
                onChange={(e) => setDepositReceived(e.target.checked)}
                className="h-4 w-4 accent-ink"
              />
              <label htmlFor="depositReceived" className="font-sans text-sm uppercase tracking-widest cursor-pointer">
                Deposit received
              </label>
            </div>
            <p className="font-sans text-xs text-muted pl-7">
              {depositReceived
                ? 'Status will be set to Confirmed'
                : 'Status will be set to Pending (owner-managed, no auto-expire)'}
            </p>
          </div>

          {error && <p className="text-red-600 font-sans text-sm">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="w-full bg-ink text-bg px-6 py-3 font-sans text-xs uppercase tracking-widest hover:opacity-80 transition-opacity disabled:opacity-50"
          >
            {isPending ? 'Creating...' : 'Create Booking'}
          </button>
        </div>
      </div>
    </div>
  )
}
