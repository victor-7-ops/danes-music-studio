import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { DmsHero } from '@/components/DmsHero'
import { GrainOverlay } from '@/components/GrainOverlay'
import { InsideStudioStrip } from '@/components/InsideStudioStrip'
import { SiteFooter } from '@/components/SiteFooter'

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'Danes Music Studio',
  image: 'https://danesmusicstudio.vercel.app/hero/studio-session.jpg',
  url: 'https://danesmusicstudio.vercel.app',
  email: 'dlivesessions@gmail.com',
  priceRange: '₱₱',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Jumalon St., Laguna Basak',
    addressLocality: 'Pardo, Cebu City',
    postalCode: '6000',
    addressCountry: 'PH',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 10.2904186,
    longitude: 123.864584,
  },
  hasMap: 'https://maps.app.goo.gl/q2jAtE7dqVpUWhZK7',
  openingHoursSpecification: {
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: [
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
    ],
    opens: '09:00',
    closes: '22:00',
  },
  sameAs: [
    'https://www.facebook.com/DaneMusicStudio',
    'https://www.instagram.com/danes.studio',
    'https://www.youtube.com/@dmsproductions-ceb',
    'https://dmsstudio.carrd.co',
  ],
}

export default async function Page() {
  const supabase = await createClient()
  const { data: files } = await supabase.storage.from('studio-photos').list()
  const imageExtensions = /\.(jpe?g|png|webp|avif)$/i
  const urls = (files ?? [])
    .filter(f => imageExtensions.test(f.name))
    .map(f => supabase.storage.from('studio-photos').getPublicUrl(f.name).data.publicUrl)

  return (
    <main className="min-h-screen bg-bg flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />

      {/* Hero — cinematic full-bleed session photo */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden bg-black">
        <Image
          src="/hero/studio-session.jpg"
          alt=""
          fill
          priority
          className="object-cover"
          style={{ objectPosition: '50% 35%' }}
          sizes="100vw"
        />

        {/* Vignette — heavy at the edges, clear through the center where the photo's subject is */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 70% 60% at 50% 40%, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.75) 60%, rgba(0,0,0,0.92) 100%)',
          }}
        />
        {/* Bottom gradient — grounds the CTA area in solid black so text never fights the photo */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/70 to-transparent" />

        {/* Warm amber glow behind the logo — the one accent color, pulled from the room's own wood tones */}
        <div
          className="absolute left-1/2 top-[30%] -translate-x-1/2 -translate-y-1/2 h-[420px] w-[420px] rounded-full blur-[100px]"
          style={{ backgroundColor: 'rgba(200, 130, 60, 0.25)' }}
        />

        <GrainOverlay opacity={0.06} />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="mb-8" style={{ '--wave-color': 'white' } as React.CSSProperties}>
            <DmsHero />
          </div>

          <h1 className="font-display text-6xl sm:text-8xl uppercase tracking-tight text-white leading-none mb-4">
            Music Studio
          </h1>

          <p className="font-sans text-base text-white/70 max-w-xs leading-relaxed mb-6">
            One room. No distractions. Book by the hour.
          </p>

          <p className="font-sans text-sm font-medium uppercase tracking-[0.09em] text-white/60">
            ₱350 / hour &middot; Daily 9 AM – 10 PM
          </p>

          <a
            href="https://maps.app.goo.gl/q2jAtE7dqVpUWhZK7"
            target="_blank"
            rel="noopener noreferrer"
            className="font-sans text-sm text-white/50 underline underline-offset-2 mt-3"
          >
            Pardo, Cebu City
          </a>

          <Link
            href="/book"
            className="inline-block mt-8 px-10 py-4 bg-white text-ink font-sans text-xs font-medium uppercase tracking-[0.1em] w-full sm:w-auto"
          >
            Book Now
          </Link>
        </div>
      </section>

      <InsideStudioStrip />

      {urls.length > 0 && (
        <section className="w-full max-w-4xl mx-auto mt-16 px-6 pb-16">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {urls.map((url, i) => (
              <div key={i} className="relative aspect-square bg-border overflow-hidden">
                <Image
                  src={url}
                  alt="Danes Music Studio — Pardo, Cebu City recording and rehearsal room"
                  fill
                  className="object-cover"
                  sizes="(min-width: 640px) 33vw, 50vw"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      <SiteFooter />
    </main>
  )
}
