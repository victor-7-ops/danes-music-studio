'use client'

import Image from 'next/image'

export default function Page() {
  return (
    <main className="relative min-h-screen bg-bg flex flex-col items-center justify-center px-6 py-16">

      {/* DMS logo */}
      <div className="mb-6 relative" style={{ width: 320, height: 209 }}>
        {/* mix-blend-mode:multiply removes white PNG background on #FAFAF8 */}
        <Image
          src="/dms.png"
          alt="Danes Music Studio"
          width={320}
          height={209}
          priority
          style={{ display: 'block', mixBlendMode: 'multiply' }}
        />

        {/* Mask: hides original static soundwave bars in the PNG */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '50%',
            left: 38,
            transform: 'translateY(-50%)',
            width: 82,
            height: 70,
            background: '#FAFAF8',
          }}
        />

        {/* Animated bars overlay — sits on top of mask, same position as original bars */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '50%',
            left: 42,
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            height: 56,
          }}
        >
          {[
            { delay: '0s',     minH: 8,  maxH: 20 },
            { delay: '0.1s',   minH: 14, maxH: 34 },
            { delay: '0.2s',   minH: 20, maxH: 48 },
            { delay: '0.3s',   minH: 26, maxH: 56 },
            { delay: '0.4s',   minH: 22, maxH: 50 },
            { delay: '0.5s',   minH: 26, maxH: 56 },
            { delay: '0.6s',   minH: 20, maxH: 48 },
            { delay: '0.7s',   minH: 14, maxH: 34 },
            { delay: '0.8s',   minH: 8,  maxH: 20 },
          ].map((bar, i) => (
            <span
              key={i}
              style={{
                display: 'block',
                width: 3,
                borderRadius: 2,
                backgroundColor: '#0B0B0C',
                animation: `dmsWave 1.2s ease-in-out infinite`,
                animationDelay: bar.delay,
                height: bar.minH,
                // CSS custom props for keyframe targets
                ['--min-h' as string]: `${bar.minH}px`,
                ['--max-h' as string]: `${bar.maxH}px`,
              }}
            />
          ))}
        </div>
      </div>

      <style jsx global>{`
        @keyframes dmsWave {
          0%, 100% { height: var(--min-h); }
          50%       { height: var(--max-h); }
        }
      `}</style>

      {/* Thin divider below logo */}
      <div className="mb-8" style={{ width: 60, height: 1, background: 'rgba(11,11,12,0.15)' }} />

      {/* Headline — Big Shoulders Display via font-display utility */}
      <h1 className="font-display text-5xl sm:text-7xl uppercase tracking-tight text-ink text-center mb-4">
        Rehearsal Studio
      </h1>

      {/* Subline — DM Sans body */}
      <p className="font-sans text-base text-muted text-center max-w-xs leading-relaxed mb-8">
        One room. No distractions. Book by the hour.
      </p>

      {/* Rate label — DM Sans 500, small-caps tracking per CONTEXT.md */}
      <p className="font-sans text-sm font-medium uppercase tracking-[0.09em] text-muted text-center">
        ₱350 / hour &middot; Daily 9 AM – 10 PM
      </p>
    </main>
  )
}
