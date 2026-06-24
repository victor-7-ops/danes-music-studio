'use client'

import { useState } from 'react'
import Link from 'next/link'

interface ReviewSummaryProps {
  date: string
  start: string
  end: string
  payment: 'full' | 'deposit'
  contactName: string
  email: string
  phone: string
  bandName: string
  onConfirm: () => Promise<void>
}

// Display only — server recomputes total in createBooking action
const RATE_CENTS = 35000

function formatCents(cents: number): string {
  return `₱${(cents / 100).toLocaleString('en-PH')}`
}

function formatHH(hhmm: string): string {
  const h = parseInt(hhmm)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${h12}:00 ${ampm}`
}

const sectionHeading = 'font-display text-sm uppercase tracking-widest text-muted mb-3'
const rowLabel = 'font-sans text-xs uppercase tracking-widest text-muted'
const rowValue = 'font-sans text-sm text-ink'

export default function ReviewSummary({
  date,
  start,
  end,
  payment,
  contactName,
  email,
  phone,
  bandName,
  onConfirm,
}: ReviewSummaryProps) {
  const [agreed, setAgreed] = useState(false)
  const [pending, setPending] = useState(false)

  const startHour = parseInt(start.split(':')[0])
  const endHour = parseInt(end.split(':')[0])
  const hours = endHour - startHour
  const totalCents = hours * RATE_CENTS
  const depositCents = Math.floor(totalCents / 2)
  const amountDue = payment === 'full' ? totalCents : depositCents
  const balanceCents = totalCents - depositCents

  const formattedDate = new Date(`${date}T00:00:00+08:00`).toLocaleDateString('en-PH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Manila',
  })

  const displayBand = bandName.trim()
    ? bandName.trim()
    : `${contactName} (no band name)`

  const backHref = `/book/details?date=${date}&start=${start}&end=${end}&payment=${payment}&name=${encodeURIComponent(contactName)}&email=${encodeURIComponent(email)}&phone=${encodeURIComponent(phone)}&band=${encodeURIComponent(bandName)}`

  async function handleConfirm() {
    setPending(true)
    try {
      await onConfirm()
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <p className="font-sans text-xs font-medium tracking-widest uppercase text-muted mb-2">
        Step 4 of 4
      </p>
      <h1 className="font-display text-5xl uppercase leading-none mb-10">
        Review Booking
      </h1>

      <div className="space-y-8">
        {/* BOOKING DETAILS */}
        <section>
          <h2 className={sectionHeading}>Booking Details</h2>
          <div className="border border-border divide-y divide-border">
            <Row label="Date" value={formattedDate} />
            <Row label="Time" value={`${formatHH(start)} – ${formatHH(end)}`} />
            <Row label="Duration" value={`${hours} hour${hours !== 1 ? 's' : ''}`} />
            <Row label="Studio" value="Rehearsal" />
          </div>
        </section>

        {/* CUSTOMER */}
        <section>
          <h2 className={sectionHeading}>Customer</h2>
          <div className="border border-border divide-y divide-border">
            <Row label="Band / Artist" value={displayBand} />
            <Row label="Contact" value={contactName} />
            <Row label="Email" value={email} />
            <Row label="Phone" value={phone} />
          </div>
        </section>

        {/* PAYMENT */}
        <section>
          <h2 className={sectionHeading}>Payment</h2>
          <div className="border border-border divide-y divide-border">
            <Row label="Rate" value="₱350 / hr" />
            <Row label="Total" value={formatCents(totalCents)} />
            <Row
              label="Payment type"
              value={payment === 'full' ? 'Full payment' : '50% deposit'}
            />
            <div className="flex justify-between items-baseline px-4 py-3">
              <span className={rowLabel}>Amount due now</span>
              <span className="font-display text-2xl text-ink font-bold">
                {formatCents(amountDue)}
              </span>
            </div>
            {payment === 'deposit' && (
              <div className="px-4 py-2">
                <p className="font-sans text-sm text-muted">
                  Balance {formatCents(balanceCents)} due on arrival
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Terms checkbox */}
      <div className="mt-8 flex items-start gap-3">
        <input
          type="checkbox"
          id="terms"
          checked={agreed}
          onChange={e => setAgreed(e.target.checked)}
          className="mt-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
        />
        <label htmlFor="terms" className="font-sans text-sm text-ink cursor-pointer">
          I confirm these details are correct and agree to the studio&apos;s booking terms.
        </label>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Link
          href={backHref}
          className="font-sans text-sm text-muted hover:text-ink underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
        >
          ← Edit details
        </Link>
        <button
          onClick={handleConfirm}
          disabled={!agreed || pending}
          className="font-sans text-sm uppercase tracking-widest bg-ink text-bg px-6 py-3 hover:opacity-80 transition-opacity motion-reduce:transition-none disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
        >
          {pending ? 'Please wait…' : 'Confirm Booking'}
        </button>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline px-4 py-3">
      <span className={rowLabel}>{label}</span>
      <span className={rowValue}>{value}</span>
    </div>
  )
}
