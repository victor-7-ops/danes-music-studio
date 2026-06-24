import Link from 'next/link'
import Image from 'next/image'
import { DmsHero } from '@/components/DmsHero'
import { createClient } from '@/lib/supabase/server'

export default async function Page() {
  const supabase = await createClient()
  const { data: files } = await supabase.storage.from('studio-photos').list()
  const imageExtensions = /\.(jpe?g|png|webp|avif)$/i
  const urls = (files ?? [])
    .filter(f => imageExtensions.test(f.name))
    .map(f => supabase.storage.from('studio-photos').getPublicUrl(f.name).data.publicUrl)

  return (
    <main className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 py-16">

      <div className="mb-12">
        <DmsHero />
      </div>

      <div className="mb-10" style={{ width: 48, height: 1, background: 'rgba(11,11,12,0.2)' }} />

      <h1 className="font-display text-6xl sm:text-8xl uppercase tracking-tight text-ink text-center mb-4 leading-none">
        Rehearsal Studio
      </h1>

      <p className="font-sans text-base text-muted text-center max-w-xs leading-relaxed mb-8">
        One room. No distractions. Book by the hour.
      </p>

      <p className="font-sans text-sm font-medium uppercase tracking-[0.09em] text-muted text-center">
        ₱350 / hour &middot; Daily 9 AM – 10 PM
      </p>

      <a
        href="https://maps.app.goo.gl/aWf4SFa3uhcY75Pe9"
        target="_blank"
        rel="noopener noreferrer"
        className="font-sans text-sm text-muted underline underline-offset-2 mt-4"
      >
        Pardo, Cebu City
      </a>

      <Link
        href="/book"
        className="inline-block mt-8 px-10 py-4 bg-ink text-white font-sans text-xs font-medium uppercase tracking-[0.1em] w-full text-center sm:w-auto"
      >
        Book Now
      </Link>

      {urls.length > 0 && (
        <section className="w-full max-w-4xl mt-16 px-0">
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
