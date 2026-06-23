'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ReviewSummary from '@/components/booking/ReviewSummary'
import { createBooking } from '@/lib/actions/createBooking'

interface ReviewPageProps {
  date: string
  start: string
  end: string
  payment: 'full' | 'deposit'
  contactName: string
  email: string
  phone: string
  bandName: string
}

export default function ReviewPage({
  date,
  start,
  end,
  payment,
  contactName,
  email,
  phone,
  bandName,
}: ReviewPageProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    setError(null)
    const result = await createBooking({
      date,
      start,
      end,
      payment,
      contactName,
      email,
      phone,
      bandName,
    })
    if (result.success) {
      router.push(`/book/confirm?code=${result.code}`)
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
        contactName={contactName}
        email={email}
        phone={phone}
        bandName={bandName}
        onConfirm={handleConfirm}
      />
    </>
  )
}
