'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ReviewSummary from '@/components/booking/ReviewSummary'
import { createBooking } from '@/lib/actions/createBooking'
import { createRecurringBooking } from '@/lib/actions/createRecurringBooking'

interface EquipmentOption {
  id: string
  name: string
  price_per_session: number
}

interface ReviewPageProps {
  date: string
  start: string
  end: string
  payment: 'full' | 'deposit'
  service: string
  serviceLabel: string
  rateCents: number
  depositPct: number
  contactName: string
  email: string
  phone: string
  bandName: string
  equipment: EquipmentOption[]
  voucherCode?: string
  voucherDiscountCents?: number
}

export default function ReviewPage({
  date,
  start,
  end,
  payment,
  service,
  serviceLabel,
  rateCents,
  depositPct,
  contactName,
  email,
  phone,
  bandName,
  equipment,
  voucherCode,
  voucherDiscountCents,
}: ReviewPageProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async (recurring: boolean, occurrenceCount: number) => {
    setError(null)

    if (recurring) {
      const result = await createRecurringBooking({
        date,
        start,
        end,
        service,
        payment,
        contactName,
        email,
        phone,
        bandName,
        equipmentIds: equipment.map((item) => item.id),
        occurrenceCount,
        voucherCode,
      })
      if (result.success) {
        router.push(`/book/series-confirm?codes=${result.codes.join(',')}&tokens=${result.tokens.join(',')}&deadline=${encodeURIComponent(result.holdExpiresAt)}`)
      } else {
        const conflictSuffix = result.conflicts?.length
          ? ` Conflicting date${result.conflicts.length > 1 ? 's' : ''}: ${result.conflicts.join(', ')}.`
          : ''
        setError(`${result.error}${conflictSuffix}`)
      }
      return
    }

    const result = await createBooking({
      date,
      start,
      end,
      service,
      payment,
      contactName,
      email,
      phone,
      bandName,
      equipmentIds: equipment.map((item) => item.id),
      voucherCode,
    })
    if (result.success) {
      router.push(`/book/confirm?code=${result.code}&token=${result.token}`)
    } else {
      setError(result.error)
    }
  }

  return (
    <>
      {error && (
        <div className="max-w-lg mx-auto mb-4 font-sans text-sm text-red-600 p-3 border border-red-200 rounded-none">
          {error}
        </div>
      )}
      <ReviewSummary
        date={date}
        start={start}
        end={end}
        payment={payment}
        service={service}
        serviceLabel={serviceLabel}
        rateCents={rateCents}
        depositPct={depositPct}
        contactName={contactName}
        email={email}
        phone={phone}
        bandName={bandName}
        equipment={equipment}
        voucherCode={voucherCode}
        voucherDiscountCents={voucherDiscountCents}
        onConfirm={handleConfirm}
      />
    </>
  )
}
