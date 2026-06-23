// src/lib/emails/format.ts
// Pure formatting utilities for email templates. No external dependencies.
// Server-only — imported only from server-side email modules.

/**
 * Format a centavos integer as a Philippine Peso string.
 * Shows decimals only when there are non-zero centavos (CLAUDE.md invariant 3).
 *
 * formatPHP(0)      → "₱0"
 * formatPHP(35000)  → "₱350"
 * formatPHP(120000) → "₱1,200"
 * formatPHP(35050)  → "₱350.50"
 */
export function formatPHP(centavos: number): string {
  const hasCentavos = centavos % 100 !== 0
  const pesos = centavos / 100
  const formatted = pesos.toLocaleString('en-PH', {
    minimumFractionDigits: hasCentavos ? 2 : 0,
    maximumFractionDigits: hasCentavos ? 2 : 0,
  })
  return `₱${formatted}`
}

/**
 * Format an ISO date string in the Asia/Manila timezone.
 *
 * formatManila(iso, 'date')     → "Tuesday, July 1, 2026"
 * formatManila(iso, 'time')     → "10:00 AM"
 * formatManila(iso, 'datetime') → "Tuesday, July 1, 2026, 10:00 AM"
 */
export function formatManila(
  isoString: string,
  format: 'date' | 'time' | 'datetime',
): string {
  const date = new Date(isoString)
  const opts: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Manila' }

  if (format !== 'time') {
    opts.weekday = 'long'
    opts.year = 'numeric'
    opts.month = 'long'
    opts.day = 'numeric'
  }

  if (format !== 'date') {
    opts.hour = 'numeric'
    opts.minute = '2-digit'
    opts.hour12 = true
  }

  return date.toLocaleString('en-PH', opts)
}
