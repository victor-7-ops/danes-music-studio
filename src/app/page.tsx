import Image from 'next/image'
import { DrumstickDivider } from '@/components/DrumstickDivider'

export default function Page() {
  return (
    <main className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 py-16">
      {/* DANES roundel — centered top */}
      <div className="mb-8">
        <Image
          src="/danes-roundel.jpg"
          alt="Danes Music Studio"
          width={120}
          height={120}
          className="rounded-full"
          priority
        />
      </div>

      {/* Drumstick divider */}
      <div className="w-24 mb-8">
        <DrumstickDivider />
      </div>

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
