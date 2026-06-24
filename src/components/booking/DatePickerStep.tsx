'use client'

import { useRouter } from 'next/navigation'
import BookingDatePicker from './DatePicker'

interface DatePickerStepProps {
  service: string
}

export default function DatePickerStep({ service }: DatePickerStepProps) {
  const router = useRouter()

  function handleDateSelect(dateStr: string) {
    router.push(`/book/slots?service=${service}&date=${dateStr}`)
  }

  return (
    <>
      <span className="font-sans text-xs uppercase tracking-widest text-muted mb-4">
        Step 2 of 5
      </span>
      <h1 className="font-display text-5xl uppercase text-ink mb-8">
        Pick a Date
      </h1>
      <BookingDatePicker onDateSelect={handleDateSelect} />
    </>
  )
}
