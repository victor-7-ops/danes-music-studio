// SVG horizontal bar chart, no chart lib (recharts install blocked by disk space).

interface Bar {
  label: string
  value: number
}

interface SourceBarChartProps {
  data: Bar[]
  /** Set false when nesting inside an already-bordered container. */
  bordered?: boolean
}

const WIDTH = 480
const ROW_H = 32
const PAD_LEFT = 72
const PAD_RIGHT = 40

export function SourceBarChart({ data, bordered = true }: SourceBarChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0)

  if (total === 0) {
    return (
      <div className={`${bordered ? 'border border-ink/20' : ''} p-6 flex items-center justify-center h-[120px]`}>
        <p className="font-sans text-sm text-muted">No data yet</p>
      </div>
    )
  }

  const max = Math.max(...data.map((d) => d.value), 1)
  const height = data.length * ROW_H
  const barW = WIDTH - PAD_LEFT - PAD_RIGHT

  const summary = `Bookings by source: ${data.map((d) => `${d.label} ${d.value}`).join(', ')}.`

  return (
    <div className={bordered ? 'border border-ink/20 p-4' : 'pt-4'}>
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        className="w-full h-auto"
        role="img"
        aria-label={summary}
      >
        <title>{summary}</title>
        {data.map((d, i) => {
          const w = (d.value / max) * barW
          const cy = i * ROW_H + ROW_H / 2
          return (
            <g key={d.label}>
              <text
                x={PAD_LEFT - 8}
                y={cy}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-ink text-[11px] font-sans uppercase tracking-wide"
              >
                {d.label}
              </text>
              <rect x={PAD_LEFT} y={cy - 8} width={barW} height={16} className="fill-ink/10" />
              <rect x={PAD_LEFT} y={cy - 8} width={w} height={16} className="fill-ink">
                <title>
                  {d.label}: {d.value}
                </title>
              </rect>
              <text
                x={PAD_LEFT + w + 6}
                y={cy}
                dominantBaseline="middle"
                className="fill-muted text-[11px] font-sans tabular-nums"
              >
                {d.value}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
