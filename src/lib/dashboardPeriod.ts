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
  prevToDate.setDate(prevToDate.getDate() - 1)
  const prevFromDate = new Date(prevToDate)
  prevFromDate.setDate(prevFromDate.getDate() - (rangeDays - 1))
  return {
    prevFrom: prevFromDate.toISOString().split('T')[0],
    prevTo: prevToDate.toISOString().split('T')[0],
  }
}
