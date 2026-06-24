// src/app/admin/dashboard/page.tsx
// Admin dashboard — Server Component. Date range via URL search params.
// All money in centavos; formatPHP for display. No float arithmetic (CLAUDE.md invariant 3).

import { createClient } from '@/lib/supabase/server'
import { formatPHP } from '@/lib/emails/format'
import { StatCard } from '@/components/admin/StatCard'

interface DashboardStats {
  collected: number
  outstanding: number
  projected: number
  bySource: { online: number; onsite: number; walk_in: number }
  counts: {
    total: number
    confirmed: number
    pending: number
    cancelled: number
    completed: number
  }
  utilization: number
  bookedHours: number
  availableHours: number
}

interface PageProps {
  searchParams: Promise<{ from?: string; to?: string }>
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams

  // Default to current month
  const now = new Date()
  const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split('T')[0]

  const from = params.from ?? defaultFrom
  const to = params.to ?? defaultTo

  const supabase = await createClient()

  // Fetch bookings in range
  const { data: bookings } = await supabase
    .from('bookings')
    .select('amount_paid, deposit_amount, total_amount, status, source, start_at, end_at')
    .gte('start_at', `${from}T00:00:00+08:00`)
    .lte('start_at', `${to}T23:59:59+08:00`)

  // Fetch settings for utilization
  const { data: settings } = await supabase
    .from('settings')
    .select('operating_open, operating_close')
    .single()

  const data = bookings ?? []

  // Revenue aggregates (integer centavo arithmetic)
  const collected = data
    .filter((b) => b.status === 'confirmed' || b.status === 'completed')
    .reduce((s, b) => s + Number(b.amount_paid), 0)

  const outstanding = data
    .filter(
      (b) =>
        b.status === 'confirmed' &&
        Number(b.amount_paid) < Number(b.deposit_amount),
    )
    .reduce((s, b) => s + (Number(b.deposit_amount) - Number(b.amount_paid)), 0)

  const projected = data
    .filter((b) => b.status === 'pending' || b.status === 'confirmed')
    .reduce((s, b) => s + Number(b.total_amount), 0)

  // Source breakdown
  const bySource = {
    online: data.filter((b) => b.source === 'online').length,
    onsite: data.filter((b) => b.source === 'onsite').length,
    walk_in: data.filter((b) => b.source === 'walk_in').length,
  }

  // Headline counts
  const counts = {
    total: data.length,
    confirmed: data.filter((b) => b.status === 'confirmed').length,
    pending: data.filter((b) => b.status === 'pending').length,
    cancelled: data.filter((b) => b.status === 'cancelled').length,
    completed: data.filter((b) => b.status === 'completed').length,
  }

  // Utilization
  let utilization = 0
  let bookedHours = 0
  let availableHours = 0

  if (settings) {
    const openHour = parseInt(settings.operating_open.split(':')[0], 10)
    const closeHour = parseInt(settings.operating_close.split(':')[0], 10)
    const hoursPerDay = closeHour - openHour

    const startD = new Date(from)
    const endD = new Date(to)
    const days =
      Math.floor((endD.getTime() - startD.getTime()) / 86400000) + 1

    availableHours = days * hoursPerDay

    bookedHours = data
      .filter((b) => b.status === 'confirmed' || b.status === 'completed')
      .reduce(
        (s, b) =>
          s +
          (new Date(b.end_at).getTime() - new Date(b.start_at).getTime()) /
            3600000,
        0,
      )

    utilization =
      availableHours > 0
        ? Math.round((bookedHours / availableHours) * 100)
        : 0
  }

  const stats: DashboardStats = {
    collected,
    outstanding,
    projected,
    bySource,
    counts,
    utilization,
    bookedHours: Math.round(bookedHours * 10) / 10,
    availableHours,
  }

  // Quick-link date helpers (computed server-side for URL generation)
  const today = new Date()
  const last7From = new Date(today)
  last7From.setDate(today.getDate() - 6)
  const last30From = new Date(today)
  last30From.setDate(today.getDate() - 29)

  const fmt = (d: Date) => d.toISOString().split('T')[0]

  const thisMonthFrom = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  const thisMonthTo = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    .toISOString()
    .split('T')[0]

  return (
    <div className="p-6 max-w-4xl space-y-8">
      <h1 className="font-display text-3xl uppercase tracking-tight text-ink">
        Dashboard
      </h1>

      {/* Date range filter */}
      <section className="space-y-3">
        <div className="flex flex-wrap gap-2 text-sm font-sans">
          <a
            href={`/admin/dashboard?from=${thisMonthFrom}&to=${thisMonthTo}`}
            className="border border-ink/20 px-3 py-1 text-ink hover:bg-ink hover:text-bg transition-colors"
          >
            This month
          </a>
          <a
            href={`/admin/dashboard?from=${fmt(last7From)}&to=${fmt(today)}`}
            className="border border-ink/20 px-3 py-1 text-ink hover:bg-ink hover:text-bg transition-colors"
          >
            Last 7 days
          </a>
          <a
            href={`/admin/dashboard?from=${fmt(last30From)}&to=${fmt(today)}`}
            className="border border-ink/20 px-3 py-1 text-ink hover:bg-ink hover:text-bg transition-colors"
          >
            Last 30 days
          </a>
        </div>

        <form method="GET" action="/admin/dashboard" className="flex flex-wrap gap-2 items-end">
          <div className="flex flex-col gap-1">
            <label htmlFor="from" className="font-sans text-xs uppercase tracking-widest text-muted">
              From
            </label>
            <input
              id="from"
              type="date"
              name="from"
              defaultValue={from}
              className="border border-ink/20 px-3 py-1.5 font-sans text-sm text-ink bg-bg"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="to" className="font-sans text-xs uppercase tracking-widest text-muted">
              To
            </label>
            <input
              id="to"
              type="date"
              name="to"
              defaultValue={to}
              className="border border-ink/20 px-3 py-1.5 font-sans text-sm text-ink bg-bg"
            />
          </div>
          <button
            type="submit"
            className="border border-ink px-4 py-1.5 font-sans text-sm uppercase tracking-widest text-ink hover:bg-ink hover:text-bg transition-colors"
          >
            Apply
          </button>
        </form>

        <p className="font-sans text-xs text-muted">
          Showing: {from} — {to}
        </p>
      </section>

      {/* Revenue */}
      <section className="space-y-3">
        <h2 className="font-display text-xl uppercase tracking-wide text-ink">
          Revenue
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            label="Collected"
            value={formatPHP(stats.collected)}
            sub="Confirmed + completed"
            accent
          />
          <StatCard
            label="Outstanding"
            value={formatPHP(stats.outstanding)}
            sub="Deposits not yet received"
          />
          <StatCard
            label="Projected"
            value={formatPHP(stats.projected)}
            sub="Pending + confirmed total"
          />
        </div>
      </section>

      {/* Utilization */}
      <section className="space-y-3">
        <h2 className="font-display text-xl uppercase tracking-wide text-ink">
          Utilization
        </h2>
        <StatCard
          label="Studio utilization"
          value={`${stats.utilization}%`}
          sub={`${stats.bookedHours}h booked of ${stats.availableHours}h available`}
        />
      </section>

      {/* Bookings by source */}
      <section className="space-y-3">
        <h2 className="font-display text-xl uppercase tracking-wide text-ink">
          Bookings by Source
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard label="Online" value={String(stats.bySource.online)} />
          <StatCard label="Onsite" value={String(stats.bySource.onsite)} />
          <StatCard label="Walk-in" value={String(stats.bySource.walk_in)} />
        </div>
      </section>

      {/* Headline counts */}
      <section className="space-y-3">
        <h2 className="font-display text-xl uppercase tracking-wide text-ink">
          Booking Counts
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Total" value={String(stats.counts.total)} />
          <StatCard label="Confirmed" value={String(stats.counts.confirmed)} />
          <StatCard label="Pending" value={String(stats.counts.pending)} />
          <StatCard label="Cancelled" value={String(stats.counts.cancelled)} />
          <StatCard label="Completed" value={String(stats.counts.completed)} />
        </div>
      </section>
    </div>
  )
}
