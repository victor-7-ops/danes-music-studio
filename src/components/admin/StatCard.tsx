// src/components/admin/StatCard.tsx
// Reusable monochrome stat card — Server Component (pure display, no client state).

interface StatCardProps {
  label: string
  value: string
  sub?: string
}

export function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <div className="border border-ink/10 p-6 flex flex-col gap-2">
      <span className="font-sans text-xs uppercase tracking-widest text-muted">
        {label}
      </span>
      <span className="font-display text-4xl uppercase tracking-tight text-ink">
        {value}
      </span>
      {sub && (
        <span className="font-sans text-sm text-muted">{sub}</span>
      )}
    </div>
  )
}
