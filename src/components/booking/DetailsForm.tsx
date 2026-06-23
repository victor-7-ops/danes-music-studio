'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface DetailsFormProps {
  date: string
  start: string
  end: string
  payment: 'full' | 'deposit'
}

// Display only — server recomputes total in createBooking action
const RATE_CENTS = 35000

function formatCents(cents: number): string {
  return `₱${(cents / 100).toLocaleString('en-PH')}`
}

export default function DetailsForm({ date, start, end, payment }: DetailsFormProps) {
  const router = useRouter()

  const [bandName, setBandName] = useState('')
  const [contactName, setContactName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const startHour = parseInt(start.split(':')[0])
  const endHour = parseInt(end.split(':')[0])
  const hours = endHour - startHour
  const totalCents = hours * RATE_CENTS
  const depositCents = Math.floor(totalCents / 2)
  const amountDue = payment === 'full' ? totalCents : depositCents

  const formattedDate = new Date(`${date}T00:00:00+08:00`).toLocaleDateString('en-PH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Manila',
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const newErrors: Record<string, string> = {}

    if (contactName.trim().length < 2) {
      newErrors.contactName = 'Name is required'
    }
    if (phone.trim().length < 7) {
      newErrors.phone = 'Phone number is required'
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Valid email is required'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    router.push(
      `/book/review?date=${date}&start=${start}&end=${end}&payment=${payment}&name=${encodeURIComponent(contactName.trim())}&email=${encodeURIComponent(email.trim())}&phone=${encodeURIComponent(phone.trim())}&band=${encodeURIComponent(bandName.trim())}`
    )
  }

  const labelClass = 'font-sans text-xs uppercase tracking-widest text-muted mb-1 block'
  const inputClass =
    'border border-border bg-surface text-ink font-sans text-base p-3 w-full rounded-none focus:outline-none focus:border-ink'
  const errorClass = 'font-sans text-xs text-red-600 mt-1'

  return (
    <div className="max-w-lg mx-auto">
      <p className="font-sans text-xs font-medium tracking-widest uppercase text-muted mb-2">
        Step 3 of 4
      </p>
      <h1 className="font-display text-5xl uppercase leading-none mb-8">
        Your Details
      </h1>

      {/* Booking summary strip */}
      <div className="border border-border bg-surface p-4 mb-8 space-y-1">
        <p className="font-sans text-sm text-muted">{formattedDate}</p>
        <p className="font-sans text-sm text-ink">
          {start} – {end} &nbsp;·&nbsp; {hours} hour{hours !== 1 ? 's' : ''}
        </p>
        <p className="font-sans text-sm font-semibold text-ink">
          Amount due: {formatCents(amountDue)}
          {payment === 'deposit' ? ' (50% deposit)' : ' (full payment)'}
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Band / Artist Name — optional */}
        <div>
          <label htmlFor="bandName" className={labelClass}>
            Band / Artist Name
          </label>
          <input
            id="bandName"
            type="text"
            value={bandName}
            onChange={e => setBandName(e.target.value)}
            placeholder="The Midnight (leave blank if solo)"
            className={inputClass}
          />
        </div>

        {/* Contact Name — required */}
        <div>
          <label htmlFor="contactName" className={labelClass}>
            Contact Name <span aria-hidden="true">*</span>
          </label>
          <input
            id="contactName"
            type="text"
            value={contactName}
            onChange={e => setContactName(e.target.value)}
            className={inputClass}
            aria-describedby={errors.contactName ? 'contactName-error' : undefined}
          />
          {errors.contactName && (
            <p id="contactName-error" className={errorClass}>
              {errors.contactName}
            </p>
          )}
        </div>

        {/* Phone — required */}
        <div>
          <label htmlFor="phone" className={labelClass}>
            Phone <span aria-hidden="true">*</span>
          </label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className={inputClass}
            aria-describedby={errors.phone ? 'phone-error' : undefined}
          />
          {errors.phone && (
            <p id="phone-error" className={errorClass}>
              {errors.phone}
            </p>
          )}
        </div>

        {/* Email — required */}
        <div>
          <label htmlFor="email" className={labelClass}>
            Email <span aria-hidden="true">*</span>
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className={inputClass}
            aria-describedby={errors.email ? 'email-error' : undefined}
          />
          {errors.email && (
            <p id="email-error" className={errorClass}>
              {errors.email}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <Link
            href={`/book/slots?date=${date}`}
            className="font-sans text-sm text-muted hover:text-ink underline"
          >
            ← Change slots
          </Link>
          <button
            type="submit"
            className="font-sans text-sm uppercase tracking-widest bg-ink text-bg px-6 py-3 hover:opacity-80 transition-opacity"
          >
            Review Booking →
          </button>
        </div>
      </form>
    </div>
  )
}
