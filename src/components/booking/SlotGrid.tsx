'use client'

import { useState } from 'react'
import { isContiguous, computeTotal } from '@/lib/slotSelection'

// TODO Phase 3: read rate from service_types
const RATE_CENTS = 35000

interface SlotGridProps {
  slots: Array<{ startAt: string; endAt: string }>
  allSlotHours: number[]
  onConfirm: (startIso: string, endIso: string, paymentType: 'full' | 'deposit') => void
}

export default function SlotGrid({ slots, allSlotHours, onConfirm }: SlotGridProps) {
  const [selectedHours, setSelectedHours] = useState<number[]>([])
  const [contiguityError, setContiguityError] = useState<string | null>(null)
  const [paymentType, setPaymentType] = useState<'full' | 'deposit'>('full')

  const { totalCents, depositCents } = computeTotal(selectedHours.length, RATE_CENTS)

  function handleSlotClick(h: number) {
    if (selectedHours.includes(h)) {
      setSelectedHours(prev => prev.filter(x => x !== h))
      setContiguityError(null)
    } else if (isContiguous(selectedHours, h)) {
      setSelectedHours(prev => [...prev, h].sort((a, b) => a - b))
      setContiguityError(null)
    } else {
      // D-06: do NOT change selection
      setContiguityError('Select contiguous hours only.')
    }
  }

  function handleConfirm() {
    if (selectedHours.length === 0) return

    const minHour = Math.min(...selectedHours)
    const maxHour = Math.max(...selectedHours)

    const startSlot = slots.find(
      s => new Date(s.startAt).getUTCHours() + 8 === minHour
    )
    const endSlot = slots.find(
      s => new Date(s.startAt).getUTCHours() + 8 === maxHour
    )

    if (!startSlot || !endSlot) return

    onConfirm(startSlot.startAt, endSlot.endAt, paymentType)
  }

  return (
    <div>
      <div className="grid grid-cols-4 gap-2 mb-4">
        {allSlotHours.map(h => {
          const available = slots.some(
            s => new Date(s.startAt).getUTCHours() + 8 === h
          )
          const selected = selectedHours.includes(h)

          const label = new Date(
            `1970-01-01T${String(h).padStart(2, '0')}:00:00+08:00`
          ).toLocaleTimeString('en-PH', {
            hour: 'numeric',
            hour12: true,
            timeZone: 'Asia/Manila',
          })

          if (!available) {
            return (
              <button
                key={h}
                aria-disabled="true"
                disabled
                className="border border-border bg-bg text-muted cursor-not-allowed line-through px-2 py-3 text-sm font-medium"
              >
                {label}
              </button>
            )
          }

          return (
            <button
              key={h}
              onClick={() => handleSlotClick(h)}
              className={
                selected
                  ? 'bg-ink text-white border border-ink px-2 py-3 text-sm font-medium cursor-pointer'
                  : 'border border-border bg-surface text-ink cursor-pointer hover:border-ink px-2 py-3 text-sm font-medium'
              }
            >
              {label}
            </button>
          )
        })}
      </div>

      {contiguityError && (
        <p className="font-sans text-xs text-red-600 mb-4">{contiguityError}</p>
      )}

      {selectedHours.length > 0 && (
        <>
          <div className="flex justify-between items-baseline mb-4 border border-border px-4 py-3">
            <span className="font-display text-lg font-extrabold uppercase">
              ₱{(totalCents / 100).toLocaleString('en-PH')}
            </span>
            <span className="text-sm text-muted">
              Deposit ₱{(depositCents / 100).toLocaleString('en-PH')}
            </span>
          </div>

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setPaymentType('full')}
              className={
                paymentType === 'full'
                  ? 'flex-1 bg-ink text-white px-4 py-3 text-sm font-medium'
                  : 'flex-1 border border-border text-ink px-4 py-3 text-sm font-medium'
              }
            >
              Full payment
            </button>
            <button
              onClick={() => setPaymentType('deposit')}
              className={
                paymentType === 'deposit'
                  ? 'flex-1 bg-ink text-white px-4 py-3 text-sm font-medium'
                  : 'flex-1 border border-border text-ink px-4 py-3 text-sm font-medium'
              }
            >
              50% deposit
            </button>
          </div>
        </>
      )}

      <button
        onClick={handleConfirm}
        disabled={selectedHours.length === 0}
        className="w-full bg-ink text-white py-4 text-xs font-medium tracking-widest uppercase disabled:bg-border disabled:cursor-not-allowed"
      >
        Continue
      </button>
    </div>
  )
}
