'use client'

import Image from 'next/image'

// Soundwave bars — symmetric bell curve shape like the reference image
const BARS = [
  { h: 18, delay: '0.00s' },
  { h: 28, delay: '0.08s' },
  { h: 42, delay: '0.16s' },
  { h: 58, delay: '0.06s' },
  { h: 72, delay: '0.20s' },
  { h: 90, delay: '0.12s' },
  { h: 100, delay: '0.00s' },
  { h: 90, delay: '0.18s' },
  { h: 72, delay: '0.10s' },
  { h: 58, delay: '0.22s' },
  { h: 42, delay: '0.04s' },
  { h: 28, delay: '0.14s' },
  { h: 18, delay: '0.08s' },
]

export function DmsHero() {
  return (
    <>
      <style>{`
        @keyframes wave {
          0%, 100% { transform: scaleY(0.25); }
          50%       { transform: scaleY(1); }
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>

        {/* Animated soundwave — left side */}
        <div
          aria-hidden="true"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            height: 100,
          }}
        >
          {BARS.map((bar, i) => (
            <span
              key={i}
              style={{
                display: 'block',
                width: 4,
                height: bar.h,
                borderRadius: 4,
                backgroundColor: 'var(--wave-color, #0B0B0C)',
                animation: `wave 1.4s ease-in-out infinite`,
                animationDelay: bar.delay,
                transformOrigin: 'center center',
              }}
            />
          ))}
        </div>

        {/* DMS logo — transparent PNG (bg already removed) */}
        <Image
          src="/dms-removebg-preview.png"
          alt="Danes Music Studio"
          width={320}
          height={104}
          priority
          style={{ display: 'block' }}
        />

      </div>
    </>
  )
}
