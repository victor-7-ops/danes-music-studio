// SVG line chart, no chart lib (recharts install blocked by disk space).
// Renders server-side; no interactivity state, so no "use client" needed.

interface Point {
  date: string
  amount: number
}

interface RevenueTrendChartProps {
  data: Point[]
}

const WIDTH = 640
const HEIGHT = 200
const PAD_LEFT = 48
const PAD_RIGHT = 12
const PAD_TOP = 12
const PAD_BOTTOM = 28

export function RevenueTrendChart({ data }: RevenueTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="border border-ink/20 p-6 flex items-center justify-center h-[200px]">
        <p className="font-sans text-sm text-muted">No data yet</p>
      </div>
    )
  }

  const max = Math.max(...data.map((d) => d.amount), 1)
  const plotW = WIDTH - PAD_LEFT - PAD_RIGHT
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM

  const x = (i: number) =>
    PAD_LEFT + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW)
  const y = (v: number) => PAD_TOP + plotH - (v / max) * plotH

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d.amount)}`).join(' ')
  const areaPath = `${linePath} L ${x(data.length - 1)} ${PAD_TOP + plotH} L ${x(0)} ${PAD_TOP + plotH} Z`

  // Show at most 6 x-axis labels to avoid crowding on wide ranges.
  const labelStep = Math.max(1, Math.ceil(data.length / 6))

  const summary = `Revenue trend over ${data.length} day${data.length === 1 ? '' : 's'}, peaking at ${formatShortPHP(max)}.`

  return (
    <div className="border border-ink/20 p-4">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-auto"
        role="img"
        aria-label={summary}
      >
        <title>{summary}</title>
        {/* Gridlines */}
        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1={PAD_LEFT}
            x2={WIDTH - PAD_RIGHT}
            y1={PAD_TOP + plotH * (1 - f)}
            y2={PAD_TOP + plotH * (1 - f)}
            stroke="currentColor"
            className="text-ink/10"
            strokeWidth={1}
          />
        ))}

        {/* Y-axis labels */}
        <text x={4} y={PAD_TOP + 4} className="fill-muted text-[9px] font-sans">
          {formatShortPHP(max)}
        </text>
        <text x={4} y={PAD_TOP + plotH + 4} className="fill-muted text-[9px] font-sans">
          ₱0
        </text>

        {/* Area + line */}
        <path d={areaPath} className="fill-ink/[0.06]" />
        <path d={linePath} fill="none" stroke="currentColor" className="text-ink" strokeWidth={2} />

        {/* Points with native tooltips */}
        {data.map((d, i) => (
          <circle key={d.date} cx={x(i)} cy={y(d.amount)} r={3} className="fill-ink">
            <title>
              {d.date}: {formatShortPHP(d.amount)}
            </title>
          </circle>
        ))}

        {/* X-axis labels */}
        {data.map((d, i) =>
          i % labelStep === 0 ? (
            <text
              key={d.date}
              x={x(i)}
              y={HEIGHT - 8}
              textAnchor="middle"
              className="fill-muted text-[9px] font-sans"
            >
              {d.date.slice(5)}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  )
}

function formatShortPHP(centavos: number): string {
  const pesos = centavos / 100
  if (pesos >= 1000) return `₱${(pesos / 1000).toFixed(1)}k`
  return `₱${Math.round(pesos)}`
}
