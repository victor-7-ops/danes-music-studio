'use client'

export function DmsLogo({ width = 280 }: { width?: number }) {
  const height = Math.round(width * 0.38)

  const bars = [
    { x: 0,  minH: 6,  maxH: 18, delay: '0s' },
    { x: 8,  minH: 10, maxH: 30, delay: '0.1s' },
    { x: 16, minH: 16, maxH: 46, delay: '0.18s' },
    { x: 24, minH: 20, maxH: 56, delay: '0.08s' },
    { x: 32, minH: 16, maxH: 46, delay: '0.22s' },
    { x: 40, minH: 20, maxH: 56, delay: '0.05s' },
    { x: 48, minH: 16, maxH: 46, delay: '0.15s' },
    { x: 56, minH: 10, maxH: 30, delay: '0.25s' },
    { x: 64, minH: 6,  maxH: 18, delay: '0.12s' },
  ]

  const svgW = 280
  const svgH = 106
  const barsW = 72   // total bars area width
  const barsX = 0    // bars start at left
  const textX = barsW + 14

  return (
    <>
      <style>{`
        @keyframes dmsBar {
          0%, 100% { transform: scaleY(var(--s-min)); }
          50%       { transform: scaleY(var(--s-max)); }
        }
      `}</style>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${svgW} ${svgH}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Danes Music Studio"
        role="img"
      >
        {/* Animated soundwave bars */}
        {bars.map((bar, i) => {
          const centerY = svgH / 2
          const sMin = (bar.minH / bar.maxH).toFixed(3)
          return (
            <rect
              key={i}
              x={barsX + bar.x}
              y={centerY - bar.maxH / 2}
              width={4}
              height={bar.maxH}
              rx={2}
              fill="#0B0B0C"
              style={{
                transformOrigin: `${barsX + bar.x + 2}px ${centerY}px`,
                animation: `dmsBar 1.3s ease-in-out infinite`,
                animationDelay: bar.delay,
                ['--s-min' as string]: sMin,
                ['--s-max' as string]: '1',
              } as React.CSSProperties}
            />
          )
        })}

        {/* DMS text — geometric, matching logo style */}
        <text
          x={textX}
          y={svgH / 2}
          dominantBaseline="central"
          fontFamily="'Big Shoulders Display', sans-serif"
          fontWeight={800}
          fontSize={72}
          letterSpacing={-1}
          fill="#0B0B0C"
        >
          DMS
        </text>
      </svg>
    </>
  )
}
