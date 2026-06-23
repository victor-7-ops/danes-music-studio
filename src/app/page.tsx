import Image from 'next/image'

export default function Page() {
  return (
    <main className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 py-16">

      {/* Hero logo — original dms.png, mix-blend-mode removes white background */}
      <div className="mb-10 flex items-center justify-center">
        <Image
          src="/dms.png"
          alt="Danes Music Studio"
          width={480}
          height={313}
          priority
          style={{ mixBlendMode: 'multiply' }}
        />
      </div>

      {/* Thin divider */}
      <div className="mb-10" style={{ width: 48, height: 1, background: 'rgba(11,11,12,0.2)' }} />

      {/* Headline */}
      <h1 className="font-display text-6xl sm:text-8xl uppercase tracking-tight text-ink text-center mb-4 leading-none">
        Rehearsal Studio
      </h1>

      {/* Subline */}
      <p className="font-sans text-base text-muted text-center max-w-xs leading-relaxed mb-8">
        One room. No distractions. Book by the hour.
      </p>

      {/* Rate */}
      <p className="font-sans text-sm font-medium uppercase tracking-[0.09em] text-muted text-center">
        ₱350 / hour &middot; Daily 9 AM – 10 PM
      </p>

    </main>
  )
}
