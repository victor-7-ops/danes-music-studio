'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { upsertSpecialHours } from '@/lib/actions/admin/upsertSpecialHours'
import { createClient } from '@/lib/supabase/client'

interface SpecialHoursRow {
  id: string
  date: string
  open_time: string | null
  close_time: string | null
  closed: boolean
}

export default function SpecialHoursPage() {
  const router = useRouter()
  const [rows, setRows] = useState<SpecialHoursRow[]>([])
  const [loadingRows, setLoadingRows] = useState(true)

  // Form state
  const [date, setDate] = useState('')
  const [isClosed, setIsClosed] = useState(false)
  const [openTime, setOpenTime] = useState('')
  const [closeTime, setCloseTime] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  async function fetchRows() {
    const supabase = createClient()
    const { data } = await supabase
      .from('special_hours')
      .select('id, date, open_time, close_time, closed')
      .order('date')
    setRows((data as SpecialHoursRow[]) ?? [])
    setLoadingRows(false)
  }

  useEffect(() => {
    fetchRows()
  }, [])

  function handleSubmit() {
    if (!date) {
      setError('Please select a date.')
      return
    }
    if (!isClosed && (!openTime || !closeTime)) {
      setError('Please provide open and close times, or mark as all-day closed.')
      return
    }
    setError(null)
    setSuccess(false)
    startTransition(async () => {
      const result = await upsertSpecialHours({
        date,
        isClosed,
        openTime: isClosed ? undefined : openTime,
        closeTime: isClosed ? undefined : closeTime,
      })
      if (result.success) {
        setSuccess(true)
        router.refresh()
        await fetchRows()
      } else {
        setError(result.error ?? 'An error occurred.')
      }
    })
  }

  return (
    <div className="min-h-screen bg-bg text-ink p-8">
      <h1 className="font-display text-3xl mb-8">Special Hours</h1>

      {/* Existing overrides table */}
      <section className="mb-12">
        <h2 className="font-sans text-sm uppercase tracking-widest text-muted mb-4">Existing Overrides</h2>
        {loadingRows ? (
          <p className="text-muted text-sm">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="text-muted text-sm">No special hours configured.</p>
        ) : (
          <table className="w-full max-w-lg font-sans text-sm">
            <thead>
              <tr className="border-b border-ink/20">
                <th className="text-left py-2 pr-6 uppercase tracking-widest text-xs text-muted">Date</th>
                <th className="text-left py-2 uppercase tracking-widest text-xs text-muted">Hours</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-ink/10">
                  <td className="py-3 pr-6 font-medium">{r.date}</td>
                  <td className="py-3 text-muted">
                    {r.closed
                      ? 'Closed all day'
                      : `${r.open_time ?? '?'} – ${r.close_time ?? '?'}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Form */}
      <section className="max-w-md">
        <h2 className="font-sans text-sm uppercase tracking-widest text-muted mb-6">Set Special Hours</h2>

        <div className="space-y-4">
          <div>
            <label className="block font-sans text-sm uppercase tracking-widest mb-2">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => { setDate(e.target.value); setSuccess(false) }}
              className="w-full border border-ink/30 bg-bg px-4 py-3 font-sans text-sm focus:outline-none focus:border-ink"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isClosed"
              checked={isClosed}
              onChange={(e) => setIsClosed(e.target.checked)}
              className="h-4 w-4 accent-ink"
            />
            <label htmlFor="isClosed" className="font-sans text-sm uppercase tracking-widest cursor-pointer">
              All-day closed
            </label>
          </div>

          {!isClosed && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-sans text-sm uppercase tracking-widest mb-2">Open</label>
                <input
                  type="time"
                  value={openTime}
                  onChange={(e) => setOpenTime(e.target.value)}
                  className="w-full border border-ink/30 bg-bg px-4 py-3 font-sans text-sm focus:outline-none focus:border-ink"
                />
              </div>
              <div>
                <label className="block font-sans text-sm uppercase tracking-widest mb-2">Close</label>
                <input
                  type="time"
                  value={closeTime}
                  onChange={(e) => setCloseTime(e.target.value)}
                  className="w-full border border-ink/30 bg-bg px-4 py-3 font-sans text-sm focus:outline-none focus:border-ink"
                />
              </div>
            </div>
          )}

          {error && <p className="text-red-600 font-sans text-sm">{error}</p>}
          {success && <p className="text-green-700 font-sans text-sm">Saved successfully.</p>}

          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="bg-ink text-bg px-6 py-3 font-sans text-xs uppercase tracking-widest hover:opacity-80 transition-opacity disabled:opacity-50"
          >
            {isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </section>
    </div>
  )
}
