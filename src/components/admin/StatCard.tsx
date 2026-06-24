interface StatCardProps {
  label: string
  value: string
  sub?: string
  accent?: boolean
}

export function StatCard({ label, value, sub, accent }: StatCardProps) {
  return (
    <div className={`border p-5 flex flex-col gap-1.5 ${accent ? 'border-ink bg-ink text-bg' : 'border-ink/20 bg-bg'}`}>
      <span className={`font-sans text-[10px] uppercase tracking-[0.15em] ${accent ? 'text-bg/60' : 'text-muted'}`}>
        {label}
      </span>
      <span className={`font-display text-3xl uppercase tracking-tight tabular-nums ${accent ? 'text-bg' : 'text-ink'}`}>
        {value}
      </span>
      {sub && (
        <span className={`font-sans text-xs ${accent ? 'text-bg/60' : 'text-muted'}`}>{sub}</span>
      )}
    </div>
  )
}
