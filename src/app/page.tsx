import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { DmsHero } from '@/components/DmsHero'

export default async function Page() {
  const supabase = await createClient()
  const { data: files } = await supabase.storage.from('studio-photos').list()
  const imageExtensions = /\.(jpe?g|png|webp|avif)$/i
  const urls = (files ?? [])
    .filter(f => imageExtensions.test(f.name))
    .map(f => supabase.storage.from('studio-photos').getPublicUrl(f.name).data.publicUrl)

  return (
    <main className="min-h-screen bg-bg flex flex-col">

      {/* Hero — full-screen background */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6">
        {/* Background image */}
        <Image
          src="/danes-logo-hero.jpg"
          alt=""
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/60" />

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
            href="https://maps.app.goo.gl/aWf4SFa3uhcY75Pe9"
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

      {urls.length > 0 && (
        <section className="w-full max-w-4xl mx-auto mt-16 px-6 pb-16">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {urls.map((url, i) => (
              <div key={i} className="relative aspect-square bg-border overflow-hidden">
                <Image
                  src={url}
                  alt="Studio"
                  fill
                  className="object-cover"
                  sizes="(min-width: 640px) 33vw, 50vw"
                />
              </div>
            ))}
          </div>
        </section>
      )}

    </main>
  )
}
