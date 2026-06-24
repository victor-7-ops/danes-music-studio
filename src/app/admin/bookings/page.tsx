import { createClient } from '@/lib/supabase/server'
import { formatPHP } from '@/lib/emails/format'

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const STATUS_BADGE_CLASS: Record<string, string> = {
  pending: 'border border-[#6B6B6B] text-ink',
  confirmed: 'bg-ink text-bg',
  completed: 'bg-[#3D3D3D] text-bg',
  cancelled: 'bg-[#E5E5E5] text-[#9A9A9A]',
}

interface SearchParams {
  status?: string
  from?: string
  to?: string
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('bookings')
    .select(
      'id, confirmation_code, band_name, customer_name, start_at, end_at, status, source, amount_paid, deposit_amount, total_amount'
    )
    .order('start_at', { ascending: false })

  if (params.status) {
    query = query.eq('status', params.status)
  }
  if (params.from) {
    query = query.gte('start_at', `${params.from}T00:00:00+08:00`)
  }
  if (params.to) {
    query = query.lte('start_at', `${params.to}T23:59:59+08:00`)
  }

  const { data: bookings } = await query

  return (
    <div className="p-6">
      <h1 className="font-display text-3xl uppercase tracking-wide mb-6">Bookings</h1>

      {/* Filter bar */}
      <form method="GET" className="flex flex-wrap gap-3 mb-6 items-end">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="status-filter"
            className="text-xs uppercase tracking-widest text-muted font-sans"
          >
            Status
          </label>
          <select
            id="status-filter"
            name="status"
            defaultValue={params.status ?? ''}
            className="border border-muted px-3 py-2 bg-bg text-ink font-sans text-sm focus:outline-none focus:border-ink"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="from-filter"
            className="text-xs uppercase tracking-widest text-muted font-sans"
          >
            From
          </label>
          <input
            id="from-filter"
            type="date"
            name="from"
            defaultValue={params.from ?? ''}
            className="border border-muted px-3 py-2 bg-bg text-ink font-sans text-sm focus:outline-none focus:border-ink"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="to-filter"
            className="text-xs uppercase tracking-widest text-muted font-sans"
          >
            To
          </label>
          <input
            id="to-filter"
            type="date"
            name="to"
            defaultValue={params.to ?? ''}
            className="border border-muted px-3 py-2 bg-bg text-ink font-sans text-sm focus:outline-none focus:border-ink"
          />
        </div>

        <button
          type="submit"
          className="bg-ink text-bg px-6 py-2 hover:opacity-80 transition-opacity uppercase tracking-widest font-sans text-sm"
        >
          Filter
        </button>

        {(params.status || params.from || params.to) && (
          <a
            href="/admin/bookings"
            className="border border-muted text-ink px-6 py-2 hover:bg-[#E5E5E5] transition-colors uppercase tracking-widest font-sans text-sm"
          >
            Clear
          </a>
        )}
      </form>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm font-sans border-collapse">
          <thead>
            <tr className="border-b border-ink/20">
              {[
                'Date',
                'Time',
                'Code',
                'Band / Customer',
                'Status',
                'Source',
                'Deposit',
                'Paid',
                'Total',
              ].map((col) => (
                <th
                  key={col}
                  className="text-left py-3 px-2 text-xs uppercase tracking-widest text-muted font-sans font-normal"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(bookings ?? []).length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="py-10 text-center text-muted font-sans"
                >
                  No bookings found.
                </td>
              </tr>
            ) : (
              (bookings ?? []).map((b) => {
                const start = new Date(b.start_at)
                const end = new Date(b.end_at)
                const dateStr = start.toLocaleDateString('en-PH', {
                  timeZone: 'Asia/Manila',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
                const timeStr = `${start.toLocaleTimeString('en-PH', {
                  timeZone: 'Asia/Manila',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                })} – ${end.toLocaleTimeString('en-PH', {
                  timeZone: 'Asia/Manila',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                })}`

                return (
                  <tr
                    key={b.id}
                    className="border-b border-ink/10 hover:bg-ink/[0.03] transition-colors cursor-default"
                  >
                    <td className="py-3 px-2 text-ink">{dateStr}</td>
                    <td className="py-3 px-2 text-ink whitespace-nowrap">{timeStr}</td>
                    <td className="py-3 px-2 text-ink font-mono text-xs">
                      {b.confirmation_code}
                    </td>
                    <td className="py-3 px-2 text-ink">
                      {b.band_name ?? b.customer_name}
                    </td>
                    <td className="py-3 px-2">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs uppercase tracking-widest ${STATUS_BADGE_CLASS[b.status] ?? 'text-muted'}`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-muted uppercase text-xs tracking-widest">
                      {b.source.replace('_', ' ')}
                    </td>
                    <td className="py-3 px-2 text-ink tabular-nums">{formatPHP(b.deposit_amount)}</td>
                    <td className="py-3 px-2 text-ink tabular-nums">{formatPHP(b.amount_paid)}</td>
                    <td className="py-3 px-2 text-ink tabular-nums">{formatPHP(b.total_amount)}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
