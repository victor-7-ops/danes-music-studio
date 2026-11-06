export function getDashboardRange(from: string | undefined, to: string | undefined, defaultFrom: string, defaultTo: string) {
  const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  const start = from ?? defaultFrom
  const end = to ?? defaultTo
  if (!validDate(start) || !validDate(end) || start > end) return { from: defaultFrom, to: defaultTo }
  return { from: start, to: end }
}

/**
 * Computes the "previous period" date range equivalent to [from, to].
 * Used for period-over-period comparison on the admin dashboard.
 *
 * The previous period is the same length (in days) as [from, to],
 * ending the day immediately before `from`.
 *
 * e.g. from=2026-02-01, to=2026-02-07 (7 days) → prevFrom=2026-01-25, prevTo=2026-01-31
 */
export function getPreviousPeriod(from: string, to: string): { prevFrom: string; prevTo: string } {
  const rangeDays = Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1
  const prevToDate = new Date(from)
  prevToDate.setUTCDate(prevToDate.getUTCDate() - 1)
  const prevFromDate = new Date(prevToDate)
  prevFromDate.setUTCDate(prevFromDate.getUTCDate() - (rangeDays - 1))
  return {
    prevFrom: prevFromDate.toISOString().split('T')[0],
    prevTo: prevToDate.toISOString().split('T')[0],
  }
}
