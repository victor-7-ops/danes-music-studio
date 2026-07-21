// src/app/admin/dashboard/page.tsx
// Admin dashboard — Server Component. Date range via URL search params.
// All money in centavos; formatPHP for display. No float arithmetic (CLAUDE.md invariant 3).

import { createClient } from '@/lib/supabase/server'
import { formatPHP } from '@/lib/emails/format'
import { StatCard } from '@/components/admin/StatCard'
import { RevenueTrendChart } from '@/components/admin/RevenueTrendChart'
import { SourceBarChart } from '@/components/admin/SourceBarChart'
import { getPreviousPeriod } from '@/lib/dashboardPeriod'

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

// `from`/`to` are plain calendar dates (YYYY-MM-DD), not instants — format
// with timeZone: 'UTC' so Intl doesn't shift the date across the Manila offset.
function formatShortDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-PH', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// Tailwind's JIT purge needs statically-discoverable class names — a
// template-literal `md:grid-cols-${n}` would never get generated.
const MONTH_GRID_COLS: Record<number, string> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
}

// `monthKey` is "YYYY-MM".
function formatMonthLabel(monthKey: string): string {
  return new Date(`${monthKey}-01T00:00:00Z`).toLocaleDateString('en-PH', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
  })
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

  // Fetch bookings in range.
  // .limit() is a defensive runaway-query guard (well above any realistic
  // single-studio monthly booking count), not real pagination. If a studio
  // ever legitimately exceeds this in one query window, the fix is a proper
  // Postgres aggregate RPC, not raising this number.
  const { data: bookings } = await supabase
    .from('bookings')
    .select('amount_paid, deposit_amount, total_amount, status, source, start_at, end_at')
    .gte('start_at', `${from}T00:00:00+08:00`)
    .lte('start_at', `${to}T23:59:59+08:00`)
    .limit(5000)

  // Fetch settings for utilization
  const { data: settings } = await supabase
    .from('settings')
    .select('operating_open, operating_close')
    .single()

  // Fetch bookings for the equivalent prior period (period-over-period comparison)
  const { prevFrom, prevTo } = getPreviousPeriod(from, to)
  const { data: prevBookings } = await supabase
    .from('bookings')
    .select('amount_paid, status')
    .gte('start_at', `${prevFrom}T00:00:00+08:00`)
    .lte('start_at', `${prevTo}T23:59:59+08:00`)
    .limit(5000)

  const data = bookings ?? []
  const prevData = prevBookings ?? []

  // Prior-period collected (same condition as current period's `collected`, below)
  const prevCollected = prevData
    .filter((b) => b.status === 'confirmed' || b.status === 'completed')
    .reduce((s, b) => s + Number(b.amount_paid), 0)

  // Single-pass aggregation: all current-period stats computed in one
  // reduce() over `data` instead of 8+ separate filter/reduce scans.
  // If you add a new stat, extend this accumulator rather than adding
  // another separate pass over `data`.
  interface StatsAccumulator {
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
    bookedHours: number
    dailyRevenue: Record<string, number>
    monthlyRevenue: Record<string, number>
    monthlyBookedHours: Record<string, number>
  }

  const agg = data.reduce<StatsAccumulator>(
    (acc, b) => {
      const amountPaid = Number(b.amount_paid)
      const isRevenue = b.status === 'confirmed' || b.status === 'completed'

      // Revenue aggregates (integer centavo arithmetic)
      if (isRevenue) {
        acc.collected += amountPaid
        const phDate = new Date(b.start_at).toLocaleDateString('en-CA', {
          timeZone: 'Asia/Manila',
        })
        acc.dailyRevenue[phDate] = (acc.dailyRevenue[phDate] ?? 0) + amountPaid
        const phMonth = phDate.slice(0, 7)
        acc.monthlyRevenue[phMonth] = (acc.monthlyRevenue[phMonth] ?? 0) + amountPaid
      }

      if (b.status === 'confirmed' && amountPaid < Number(b.deposit_amount)) {
        acc.outstanding += Number(b.deposit_amount) - amountPaid
      }

      if (b.status === 'pending' || b.status === 'confirmed') {
        acc.projected += Number(b.total_amount)
      }

      // Source breakdown
      if (b.source === 'online') acc.bySource.online++
      else if (b.source === 'onsite') acc.bySource.onsite++
      else if (b.source === 'walk_in') acc.bySource.walk_in++

      // Headline counts
      acc.counts.total++
      if (b.status === 'confirmed') acc.counts.confirmed++
      else if (b.status === 'pending') acc.counts.pending++
      else if (b.status === 'cancelled') acc.counts.cancelled++
      else if (b.status === 'completed') acc.counts.completed++

      // Booked hours (utilization)
      if (isRevenue) {
        const hours =
          (new Date(b.end_at).getTime() - new Date(b.start_at).getTime()) / 3600000
        acc.bookedHours += hours
        const phMonth = new Date(b.start_at).toLocaleDateString('en-CA', {
          timeZone: 'Asia/Manila',
        }).slice(0, 7)
        acc.monthlyBookedHours[phMonth] = (acc.monthlyBookedHours[phMonth] ?? 0) + hours
      }

      return acc
    },
    {
      collected: 0,
      outstanding: 0,
      projected: 0,
      bySource: { online: 0, onsite: 0, walk_in: 0 },
      counts: { total: 0, confirmed: 0, pending: 0, cancelled: 0, completed: 0 },
      bookedHours: 0,
      dailyRevenue: {},
      monthlyRevenue: {},
      monthlyBookedHours: {},
    },
  )

  // Fill zero-revenue days so the trend line shows gaps, not a skipped axis.
  const dailyRevenueSeries: { date: string; amount: number }[] = []
  {
    const cursor = new Date(from)
    const endD = new Date(to)
    while (cursor <= endD) {
      const key = cursor.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
      dailyRevenueSeries.push({ date: key, amount: agg.dailyRevenue[key] ?? 0 })
      cursor.setDate(cursor.getDate() + 1)
    }
  }

  // Utilization
  let utilization = 0
  let availableHours = 0

  // Whole-month range spanning more than one calendar month — shown as a
  // per-month breakdown instead of a single aggregate stat.
  const spanDays = Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1
  const isMultiMonth = spanDays > 31

  const monthlyRevenueSeries: { date: string; amount: number }[] = []
  const monthlyUtilization: { month: string; pct: number; bookedHours: number; availableHours: number }[] = []

  if (settings) {
    const openHour = parseInt(settings.operating_open.split(':')[0], 10)
    const closeHour = parseInt(settings.operating_close.split(':')[0], 10)
    const hoursPerDay = closeHour - openHour

    const startD = new Date(from)
    const endD = new Date(to)
    const days =
      Math.floor((endD.getTime() - startD.getTime()) / 86400000) + 1

    availableHours = days * hoursPerDay

    utilization =
      availableHours > 0
        ? Math.round((agg.bookedHours / availableHours) * 100)
        : 0

    if (isMultiMonth) {
      const monthCursor = new Date(startD.getFullYear(), startD.getMonth(), 1)
      const endMonth = new Date(endD.getFullYear(), endD.getMonth(), 1)
      while (monthCursor <= endMonth) {
        const monthKey = `${monthCursor.getFullYear()}-${String(monthCursor.getMonth() + 1).padStart(2, '0')}`
        const daysInMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0).getDate()
        const monthAvailableHours = daysInMonth * hoursPerDay
        const monthBookedHours = agg.monthlyBookedHours[monthKey] ?? 0
        monthlyUtilization.push({
          month: monthKey,
          pct: monthAvailableHours > 0 ? Math.round((monthBookedHours / monthAvailableHours) * 100) : 0,
          bookedHours: Math.round(monthBookedHours * 10) / 10,
          availableHours: monthAvailableHours,
        })
        monthlyRevenueSeries.push({
          date: `${monthKey}-01`,
          amount: agg.monthlyRevenue[monthKey] ?? 0,
        })
        monthCursor.setMonth(monthCursor.getMonth() + 1)
      }
    }
  }

  // bookedHours is only meaningful (and previously only computed) when
  // settings exist — preserve that: display 0 rather than a stray figure
  // when operating hours aren't configured.
  const bookedHours = settings ? agg.bookedHours : 0

  const stats: DashboardStats = {
    collected: agg.collected,
    outstanding: agg.outstanding,
    projected: agg.projected,
    bySource: agg.bySource,
    counts: agg.counts,
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

  // N-month quick links: from the first day of (N-1) months ago through the
  // end of the current month.
  function monthsRangeHref(n: number): string {
    const start = new Date(today.getFullYear(), today.getMonth() - (n - 1), 1)
    const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`
    return `/admin/dashboard?from=${startStr}&to=${thisMonthTo}`
  }

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
            className="border border-ink/20 px-3 py-1 min-h-11 flex items-center text-ink hover:bg-ink hover:text-bg transition-colors"
          >
            This month
          </a>
          <a
            href={`/admin/dashboard?from=${fmt(last7From)}&to=${fmt(today)}`}
            className="border border-ink/20 px-3 py-1 min-h-11 flex items-center text-ink hover:bg-ink hover:text-bg transition-colors"
          >
            Last 7 days
          </a>
          <a
            href={`/admin/dashboard?from=${fmt(last30From)}&to=${fmt(today)}`}
            className="border border-ink/20 px-3 py-1 min-h-11 flex items-center text-ink hover:bg-ink hover:text-bg transition-colors"
          >
            Last 30 days
          </a>
          <a
            href={monthsRangeHref(1)}
            className="border border-ink/20 px-3 py-1 min-h-11 flex items-center text-ink hover:bg-ink hover:text-bg transition-colors"
          >
            1 month
          </a>
          <a
            href={monthsRangeHref(2)}
            className="border border-ink/20 px-3 py-1 min-h-11 flex items-center text-ink hover:bg-ink hover:text-bg transition-colors"
          >
            2 months
          </a>
          <a
            href={monthsRangeHref(3)}
            className="border border-ink/20 px-3 py-1 min-h-11 flex items-center text-ink hover:bg-ink hover:text-bg transition-colors"
          >
            3 months
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
              aria-describedby="date-range-summary"
              className="border border-ink/20 px-3 py-1.5 min-h-11 font-sans text-sm text-ink bg-bg"
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
              aria-describedby="date-range-summary"
              className="border border-ink/20 px-3 py-1.5 min-h-11 font-sans text-sm text-ink bg-bg"
            />
          </div>
          <button
            type="submit"
            className="border border-ink px-4 py-1.5 min-h-11 font-sans text-sm uppercase tracking-widest text-ink hover:bg-ink hover:text-bg transition-colors"
          >
            Apply
          </button>
        </form>

        <p id="date-range-summary" className="font-sans text-xs text-muted">
          Showing: {formatShortDate(from)} — {formatShortDate(to)}
        </p>
      </section>

      {/* Revenue */}
      <section className="space-y-3">
        <h2 className="font-display text-xl uppercase tracking-wide text-ink">
          Revenue
        </h2>
        <div className="border border-ink/20">
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-ink/20">
            <StatCard
              label="Collected"
              value={formatPHP(stats.collected)}
              sub="Confirmed + completed"
              accent
              currentValue={stats.collected}
              previousValue={prevCollected}
              flush
            />
            <StatCard
              label="Outstanding"
              value={formatPHP(stats.outstanding)}
              sub="Deposits not yet received"
              flush
            />
            <StatCard
              label="Projected"
              value={formatPHP(stats.projected)}
              sub="Pending + confirmed total"
              flush
            />
          </div>
          <div className="border-t border-ink/20">
            <RevenueTrendChart
              data={isMultiMonth ? monthlyRevenueSeries : dailyRevenueSeries}
              bordered={false}
              granularity={isMultiMonth ? 'month' : 'day'}
            />
          </div>
        </div>
      </section>

      {/* Utilization */}
      <section className="space-y-3">
        <h2 className="font-display text-xl uppercase tracking-wide text-ink">
          Utilization
        </h2>
        {isMultiMonth ? (
          <div className={`grid grid-cols-1 gap-4 ${MONTH_GRID_COLS[Math.min(monthlyUtilization.length, 3)] ?? 'md:grid-cols-3'}`}>
            {monthlyUtilization.map((m) => (
              <StatCard
                key={m.month}
                label={formatMonthLabel(m.month)}
                value={`${m.pct}%`}
                sub={`${m.bookedHours}h booked of ${m.availableHours}h available`}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              label="Studio utilization"
              value={`${stats.utilization}%`}
              sub={`${stats.bookedHours}h booked of ${stats.availableHours}h available`}
            />
          </div>
        )}
      </section>

      {/* Bookings by source */}
      <section className="space-y-3">
        <h2 className="font-display text-xl uppercase tracking-wide text-ink">
          Bookings by Source
        </h2>
        <div className="border border-ink/20">
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-ink/20">
            <StatCard label="Online" value={String(stats.bySource.online)} flush />
            <StatCard label="Onsite" value={String(stats.bySource.onsite)} flush />
            <StatCard label="Walk-in" value={String(stats.bySource.walk_in)} flush />
          </div>
          <div className="border-t border-ink/20">
            <SourceBarChart
              data={[
                { label: 'Online', value: stats.bySource.online },
                { label: 'Onsite', value: stats.bySource.onsite },
                { label: 'Walk-in', value: stats.bySource.walk_in },
              ]}
              bordered={false}
            />
          </div>
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
