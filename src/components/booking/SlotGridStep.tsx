'use client'

import { useRouter } from 'next/navigation'
import SlotGrid from './SlotGrid'

interface SlotGridStepProps {
  date: string
  slots: Array<{ startAt: string; endAt: string }>
  allSlotHours: number[]
}

export default function SlotGridStep({ date, slots, allSlotHours }: SlotGridStepProps) {
  const router = useRouter()

  function onConfirm(
    startIso: string,
    endIso: string,
    paymentType: 'full' | 'deposit'
  ) {
    const startHHMM = new Date(startIso).toLocaleTimeString('en-PH', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Manila',
    })
    const endHHMM = new Date(endIso).toLocaleTimeString('en-PH', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Manila',
    })
    router.push(
      `/book/details?date=${date}&start=${startHHMM}&end=${endHHMM}&payment=${paymentType}`
    )
  }

  const formattedDate = new Date(`${date}T00:00:00+08:00`).toLocaleDateString(
    'en-PH',
    {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Manila',
    }
  )

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-lg mx-auto px-6 py-16">
        <p className="font-sans text-xs font-medium tracking-widest uppercase text-muted mb-2">
          Step 2 of 4
        </p>
        <h1 className="font-display text-5xl font-extrabold uppercase leading-none mb-2">
          Pick Your Hours
        </h1>
        <p className="font-sans text-sm text-muted mb-8">{formattedDate}</p>

        <SlotGrid
          slots={slots}
          allSlotHours={allSlotHours}
          onConfirm={onConfirm}
        />
      </div>
    </div>
  )
}
