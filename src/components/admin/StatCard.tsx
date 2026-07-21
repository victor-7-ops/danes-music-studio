interface StatCardProps {
  label: string
  value: string
  sub?: string
  accent?: boolean
  /** Previous-period value (same unit as currentValue) for a period-over-period delta. */
  previousValue?: number
  /** Current-period raw numeric value, paired with previousValue to compute the delta. */
  currentValue?: number
  /** Drop this card's own border — used when a parent container already supplies the border/dividers. */
  flush?: boolean
}

export function StatCard({ label, value, sub, accent, previousValue, currentValue, flush }: StatCardProps) {
  let deltaLabel: string | null = null
  if (previousValue !== undefined && currentValue !== undefined) {
    if (previousValue === 0) {
      deltaLabel = currentValue === 0 ? null : 'new vs. last period'
    } else {
      const deltaPct = Math.round(((currentValue - previousValue) / previousValue) * 100)
      const sign = deltaPct > 0 ? '+' : ''
      deltaLabel = `${sign}${deltaPct}% vs. last period`
    }
  }

  return (
    <div
      className={`p-5 flex flex-col gap-1.5 ${
        flush ? (accent ? 'bg-ink text-bg' : 'bg-bg') : `border ${accent ? 'border-ink bg-ink text-bg' : 'border-ink/20 bg-bg'}`
      }`}
    >
      <span className={`font-sans text-[10px] uppercase tracking-[0.15em] ${accent ? 'text-bg/60' : 'text-muted'}`}>
        {label}
      </span>
      <span className={`font-display text-3xl uppercase tracking-tight tabular-nums ${accent ? 'text-bg' : 'text-ink'}`}>
        {value}
      </span>
      {sub && (
        <span className={`font-sans text-xs ${accent ? 'text-bg/60' : 'text-muted'}`}>{sub}</span>
      )}
      {deltaLabel && (
        <span className={`font-sans text-xs tabular-nums ${accent ? 'text-bg/80' : 'text-ink/70'}`}>
          {deltaLabel}
        </span>
      )}
    </div>
  )
}
