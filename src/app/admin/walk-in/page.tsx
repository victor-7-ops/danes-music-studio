'use client'

import { useState, useTransition } from 'react'
import { createWalkIn } from '@/lib/actions/admin/createWalkIn'

function todayDate(): string {
  return new Date().toISOString().split('T')[0]
}

function currentHour(): string {
  const h = new Date().getHours()
  return `${String(h).padStart(2, '0')}:00`
}

export default function WalkInPage() {
  const [date, setDate] = useState(todayDate())
  const [start, setStart] = useState(currentHour())
  const [end, setEnd] = useState('')
  const [bandName, setBandName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successCode, setSuccessCode] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function resetForm() {
    setDate(todayDate())
    setStart(currentHour())
    setEnd('')
    setBandName('')
    setError(null)
    setSuccessCode(null)
  }

  function handleSubmit() {
    if (!date || !start || !end) {
      setError('Please fill in date, start, and end time.')
      return
    }
    // Client-side: end must be after start
    const [sh] = start.split(':').map(Number)
    const [eh] = end.split(':').map(Number)
    if (eh <= sh) {
      setError('End time must be after start time.')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await createWalkIn({
        date,
        start,
        end,
        bandName: bandName.trim() || undefined,
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
          <h1 className="font-display text-3xl">Walk-In Booked</h1>
          <p className="font-sans text-sm text-muted uppercase tracking-widest">Confirmation Code</p>
          <p className="font-display text-4xl tracking-widest">{successCode}</p>
          <button
            onClick={resetForm}
            className="bg-ink text-bg px-6 py-3 font-sans text-xs uppercase tracking-widest hover:opacity-80 transition-opacity"
          >
            Book Another
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg text-ink p-8">
      <div className="max-w-sm mx-auto space-y-6">
        <h1 className="font-display text-3xl">Walk-In Booking</h1>

        <div className="space-y-4">
          <div>
            <label className="block font-sans text-sm uppercase tracking-widest mb-2">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-ink/30 bg-bg px-4 py-3 font-sans text-sm focus:outline-none focus:border-ink"
            />
          </div>

          <div>
            <label className="block font-sans text-sm uppercase tracking-widest mb-2">Start Time</label>
            <input
              type="time"
              step={3600}
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-full border border-ink/30 bg-bg px-4 py-3 font-sans text-sm focus:outline-none focus:border-ink"
            />
          </div>

          <div>
            <label className="block font-sans text-sm uppercase tracking-widest mb-2">End Time</label>
            <input
              type="time"
              step={3600}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
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

          {error && <p className="text-red-600 font-sans text-sm">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="w-full bg-ink text-bg px-6 py-3 font-sans text-xs uppercase tracking-widest hover:opacity-80 transition-opacity disabled:opacity-50"
          >
            {isPending ? 'Booking...' : 'Book Walk-In'}
          </button>
        </div>
      </div>
    </div>
  )
}
