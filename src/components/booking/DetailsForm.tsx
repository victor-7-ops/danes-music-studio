'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { quoteVoucher } from '@/lib/actions/voucherQuote'

interface EquipmentOption {
  id: string
  name: string
  price_per_session: number
}

interface DetailsFormProps {
  date: string
  start: string
  end: string
  payment: 'full' | 'deposit'
  service: string
  // Display only — server recomputes total in createBooking action
  rateCents: number
  depositPct: number
  equipment: EquipmentOption[]
  initialEquipmentIds?: string[]
  // Equipment ids that are already at capacity for this exact date/start/end
  // (computed server-side — see src/app/book/details/page.tsx). Rendered as
  // disabled/unavailable so customers see it before checkout, not as a late
  // server rejection on submit.
  unavailableEquipmentIds?: string[]
}

function formatCents(cents: number): string {
  return `₱${(cents / 100).toLocaleString('en-PH')}`
}

function formatHH(hhmm: string): string {
  const h = parseInt(hhmm)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${h12}:00 ${ampm}`
}

export default function DetailsForm({ date, start, end, payment, service, rateCents, depositPct, equipment, initialEquipmentIds, unavailableEquipmentIds }: DetailsFormProps) {
  const router = useRouter()

  const unavailableIds = new Set(unavailableEquipmentIds ?? [])

  const [bandName, setBandName] = useState('')
  const [contactName, setContactName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [selectedEquipment, setSelectedEquipment] = useState<Set<string>>(
    new Set((initialEquipmentIds ?? []).filter((id) => !unavailableIds.has(id)))
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [voucherCode, setVoucherCode] = useState('')
  const [voucherQuote, setVoucherQuote] = useState<{ valid: boolean; discountCents?: number } | null>(null)
  const voucherTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // "Book again" suggestion — debounced lookup once both email and phone are
  // filled in. See plans/012b-quick-rebook-v2.md. Silent on any failure
  // (network error, 429 rate limit, no match) — this is a convenience
  // feature, never a blocker to completing the booking.
  const [suggestion, setSuggestion] = useState<{ bandName: string | null; equipmentIds: string[] } | null>(null)
  const [suggestionDismissed, setSuggestionDismissed] = useState(false)
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const trimmedEmail = email.trim()
    const trimmedPhone = phone.trim()

    if (lookupTimer.current) clearTimeout(lookupTimer.current)

    if (!trimmedEmail || !trimmedPhone) {
      setSuggestion(null)
      setSuggestionDismissed(false)
      return
    }

    lookupTimer.current = setTimeout(() => {
      fetch('/api/booking/lookup-previous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, phone: trimmedPhone }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { bandName: string | null; equipmentIds: string[] } | null) => {
          if (data && (data.bandName || data.equipmentIds.length > 0)) {
            setSuggestion(data)
          } else {
            setSuggestion(null)
          }
        })
        .catch(() => {
          // Network error, rate limited, or malformed response — fail silently.
          setSuggestion(null)
        })
    }, 500)

    return () => {
      if (lookupTimer.current) clearTimeout(lookupTimer.current)
    }
  }, [email, phone])

  function acceptSuggestion() {
    if (!suggestion) return
    if (suggestion.bandName) setBandName(suggestion.bandName)
    if (suggestion.equipmentIds.length > 0) {
      setSelectedEquipment((prev) => {
        const next = new Set(prev)
        for (const id of suggestion.equipmentIds) {
          if (!unavailableIds.has(id)) next.add(id)
        }
        return next
      })
    }
    setSuggestionDismissed(true)
  }

  const startHour = parseInt(start.split(':')[0])
  const endHour = parseInt(end.split(':')[0])
  const hours = endHour - startHour
  const studioCents = hours * rateCents
  const equipmentCents = equipment
    .filter((item) => selectedEquipment.has(item.id))
    .reduce((sum, item) => sum + item.price_per_session, 0)
  const discountCents = voucherQuote?.valid ? Math.min(voucherQuote.discountCents ?? 0, studioCents) : 0
  const totalCents = studioCents - discountCents + equipmentCents
  const depositCents = Math.floor(totalCents * depositPct)
  const amountDue = payment === 'full' ? totalCents : depositCents

  // Live estimate only — server recomputes and reserves the discount atomically.
  useEffect(() => {
    const trimmedCode = voucherCode.trim()
    const trimmedEmail = email.trim()
    if (voucherTimer.current) clearTimeout(voucherTimer.current)
    if (!trimmedCode || !trimmedEmail) {
      setVoucherQuote(null)
      return
    }
    voucherTimer.current = setTimeout(() => {
      quoteVoucher({
        code: trimmedCode,
        service,
        sessionDate: date,
        studioSubtotalCents: studioCents,
        equipmentSubtotalCents: equipmentCents,
        email: trimmedEmail,
      })
        .then(setVoucherQuote)
        .catch(() => setVoucherQuote({ valid: false }))
    }, 500)
    return () => {
      if (voucherTimer.current) clearTimeout(voucherTimer.current)
    }
  }, [voucherCode, email, service, date, studioCents, equipmentCents])

  function toggleEquipment(id: string) {
    setSelectedEquipment((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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

    const equipmentParam = selectedEquipment.size > 0 ? [...selectedEquipment].join(',') : ''
    const voucherParam = voucherQuote?.valid ? `&voucher=${encodeURIComponent(voucherCode.trim())}` : ''

    router.push(
      `/book/review?service=${service}&date=${date}&start=${start}&end=${end}&payment=${payment}&name=${encodeURIComponent(contactName.trim())}&email=${encodeURIComponent(email.trim())}&phone=${encodeURIComponent(phone.trim())}&band=${encodeURIComponent(bandName.trim())}&equipment=${equipmentParam}${voucherParam}`
    )
  }

  const labelClass = 'font-sans text-xs uppercase tracking-widest text-muted mb-1 block'
  const inputClass =
    'border border-border bg-surface text-ink font-sans text-base p-3 w-full rounded-none focus:outline-none focus:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2'
  const errorClass = 'font-sans text-xs text-red-600 mt-1'

  return (
    <div className="max-w-lg mx-auto">
      <p className="font-sans text-xs font-medium tracking-widest uppercase text-muted mb-2">
        Step 4 of 5
      </p>
      <h1 className="font-display text-5xl uppercase leading-none mb-8">
        Your Details
      </h1>

      {/* Booking summary strip */}
      <div className="border border-border bg-surface p-4 mb-8 space-y-1">
        <p className="font-sans text-sm text-muted">{formattedDate}</p>
        <p className="font-sans text-sm text-ink">
          {formatHH(start)} – {formatHH(end)} &nbsp;·&nbsp; {hours} hour{hours !== 1 ? 's' : ''}
        </p>
        <p className="font-sans text-sm font-semibold text-ink">
          Amount due: {formatCents(amountDue)}
          {payment === 'deposit' ? ` (${Math.round(depositPct * 100)}% deposit)` : ' (full payment)'}
        </p>
      </div>

      {/* Optional equipment add-ons */}
      {equipment.length > 0 && (
        <div className="mb-8">
          <p className={labelClass}>Add Gear (optional)</p>
          <div className="border border-border divide-y divide-border">
            {equipment.map((item) => {
              const unavailable = unavailableIds.has(item.id)
              return (
                <label
                  key={item.id}
                  className={`flex items-center justify-between gap-3 px-3 py-2 ${unavailable ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedEquipment.has(item.id)}
                      onChange={() => toggleEquipment(item.id)}
                      disabled={unavailable}
                      className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:cursor-not-allowed"
                    />
                    <span className="font-sans text-sm text-ink">{item.name}</span>
                    {unavailable && (
                      <span className="font-sans text-xs uppercase tracking-widest text-red-600">
                        Unavailable for this time
                      </span>
                    )}
                  </span>
                  <span className="font-sans text-sm text-muted tabular-nums">
                    +{formatCents(item.price_per_session)}
                  </span>
                </label>
              )
            })}
          </div>
        </div>
      )}

      {/* Voucher code — optional */}
      <div className="mb-8">
        <label htmlFor="voucherCode" className={labelClass}>
          Voucher Code (optional)
        </label>
        <input
          id="voucherCode"
          type="text"
          value={voucherCode}
          onChange={e => setVoucherCode(e.target.value.toUpperCase())}
          placeholder="Enter email above first"
          className={inputClass}
        />
        {voucherCode.trim() && (
          <p className="font-sans text-xs mt-1" aria-live="polite">
            {!email.trim()
              ? <span className="text-muted">Enter your email to check this code.</span>
              : voucherQuote === null
                ? <span className="text-muted">Checking…</span>
                : voucherQuote.valid
                  ? <span className="text-ink">Estimated discount: {formatCents(voucherQuote.discountCents ?? 0)} — server confirms the final total.</span>
                  : <span className="text-red-600">Code not valid for this booking.</span>}
          </p>
        )}
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

        {suggestion && !suggestionDismissed && (
          <div className="border border-border bg-surface p-4 flex items-start justify-between gap-4">
            <p className="font-sans text-sm text-ink">
              Welcome back{suggestion.bandName ? `, ${suggestion.bandName}` : ''}! Use your details from last time?
            </p>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={acceptSuggestion}
                className="font-sans text-xs uppercase tracking-widest bg-ink text-bg px-3 py-2 hover:opacity-80 transition-opacity motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
              >
                Yes, use it
              </button>
              <button
                type="button"
                onClick={() => setSuggestionDismissed(true)}
                className="font-sans text-xs uppercase tracking-widest text-muted hover:text-ink underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <Link
            href={`/book/slots?service=${service}&date=${date}`}
            className="font-sans text-sm text-muted hover:text-ink underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
          >
            ← Change slots
          </Link>
          <button
            type="submit"
            className="font-sans text-sm uppercase tracking-widest bg-ink text-bg px-6 py-3 hover:opacity-80 transition-opacity motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
          >
            Review Booking →
          </button>
        </div>
      </form>
    </div>
  )
}
