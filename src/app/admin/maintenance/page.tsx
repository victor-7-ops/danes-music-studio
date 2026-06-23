'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClosure } from '@/lib/actions/admin/createClosure'
import type { ClosureConflict } from '@/lib/actions/admin/createClosure'
import { createClient } from '@/lib/supabase/client'

interface BlockedSlot {
  id: string
  start_at: string
  end_at: string
  reason: string | null
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function MaintenancePage() {
  const router = useRouter()
  const [closures, setClosures] = useState<BlockedSlot[]>([])
  const [loadingClosures, setLoadingClosures] = useState(true)

  // Form state
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [conflicts, setConflicts] = useState<ClosureConflict[]>([])
  const [requiresConfirmation, setRequiresConfirmation] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('blocked_slots')
      .select('id, start_at, end_at, reason')
      .eq('type', 'maintenance')
      .order('start_at')
      .then(({ data }) => {
        setClosures((data as BlockedSlot[]) ?? [])
        setLoadingClosures(false)
      })
  }, [])

  function resetForm() {
    setStartAt('')
    setEndAt('')
    setReason('')
    setError(null)
    setConflicts([])
    setRequiresConfirmation(false)
  }

  function handleSubmit(force: boolean) {
    if (!startAt || !endAt) {
      setError('Please fill in both start and end date/time.')
      return
    }
    if (new Date(startAt) >= new Date(endAt)) {
      setError('End date/time must be after start date/time.')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await createClosure({ startAt, endAt, reason: reason || undefined, force })
      if (result.success) {
        resetForm()
        router.refresh()
        // Re-fetch closures
        const supabase = createClient()
        const { data } = await supabase
          .from('blocked_slots')
          .select('id, start_at, end_at, reason')
          .eq('type', 'maintenance')
          .order('start_at')
        setClosures((data as BlockedSlot[]) ?? [])
      } else if ('requiresConfirmation' in result && result.requiresConfirmation) {
        setConflicts(result.conflicts)
        setRequiresConfirmation(true)
      } else if ('error' in result) {
        setError(result.error)
      }
    })
  }

  return (
    <div className="min-h-screen bg-bg text-ink p-8">
      <h1 className="font-display text-3xl mb-8">Maintenance Closures</h1>

      {/* Existing closures list */}
      <section className="mb-12">
        <h2 className="font-sans text-sm uppercase tracking-widest text-muted mb-4">Existing Closures</h2>
        {loadingClosures ? (
          <p className="text-muted text-sm">Loading...</p>
        ) : closures.length === 0 ? (
          <p className="text-muted text-sm">No maintenance closures scheduled.</p>
        ) : (
          <ul className="space-y-3">
            {closures.map((c) => (
              <li key={c.id} className="border border-ink/20 p-4">
                <div className="font-sans text-sm">
                  <span className="font-medium">{formatDateTime(c.start_at)}</span>
                  <span className="text-muted mx-2">→</span>
                  <span className="font-medium">{formatDateTime(c.end_at)}</span>
                </div>
                {c.reason && <p className="text-muted text-sm mt-1">{c.reason}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Create closure form */}
      <section className="max-w-md">
        <h2 className="font-sans text-sm uppercase tracking-widest text-muted mb-6">Schedule New Closure</h2>

        <div className="space-y-4">
          <div>
            <label className="block font-sans text-sm uppercase tracking-widest mb-2">Start</label>
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="w-full border border-ink/30 bg-bg px-4 py-3 font-sans text-sm focus:outline-none focus:border-ink"
            />
          </div>

          <div>
            <label className="block font-sans text-sm uppercase tracking-widest mb-2">End</label>
            <input
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              className="w-full border border-ink/30 bg-bg px-4 py-3 font-sans text-sm focus:outline-none focus:border-ink"
            />
          </div>

          <div>
            <label className="block font-sans text-sm uppercase tracking-widest mb-2">Reason (optional)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Equipment maintenance"
              className="w-full border border-ink/30 bg-bg px-4 py-3 font-sans text-sm focus:outline-none focus:border-ink"
            />
          </div>

          {error && <p className="text-red-600 font-sans text-sm">{error}</p>}

          {/* Conflict warning */}
          {requiresConfirmation && (
            <div className="border border-red-400 p-4 space-y-3">
              <p className="font-sans text-sm font-medium text-red-600">
                This closure overlaps {conflicts.length} existing booking{conflicts.length !== 1 ? 's' : ''}:
              </p>
              <ul className="space-y-2">
                {conflicts.map((c) => (
                  <li key={c.id} className="font-sans text-sm text-ink">
                    <span className="font-medium">{c.confirmation_code}</span>
                    {' — '}
                    {c.customer_name}
                    {c.band_name && ` (${c.band_name})`}
                    <br />
                    <span className="text-muted">
                      {formatDateTime(c.start_at)} → {formatDateTime(c.end_at)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="font-sans text-xs text-muted">
                These bookings will NOT be cancelled automatically. Manage them separately.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => handleSubmit(true)}
                  disabled={isPending}
                  className="bg-ink text-bg px-6 py-3 font-sans text-xs uppercase tracking-widest hover:opacity-80 transition-opacity disabled:opacity-50"
                >
                  {isPending ? 'Saving...' : 'Save Anyway'}
                </button>
                <button
                  onClick={resetForm}
                  disabled={isPending}
                  className="border border-ink text-ink px-6 py-3 font-sans text-xs uppercase tracking-widest hover:bg-ink hover:text-bg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {!requiresConfirmation && (
            <button
              onClick={() => handleSubmit(false)}
              disabled={isPending}
              className="bg-ink text-bg px-6 py-3 font-sans text-xs uppercase tracking-widest hover:opacity-80 transition-opacity disabled:opacity-50"
            >
              {isPending ? 'Checking...' : 'Schedule Closure'}
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
