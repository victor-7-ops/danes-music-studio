import Image from 'next/image'

interface Photo {
  src: string
  width: number
  height: number
}

const PHOTOS: Photo[] = [
  { src: '/inside-studio/1.jpg', width: 1536, height: 2048 },
  { src: '/inside-studio/2.jpg', width: 3456, height: 4608 },
  { src: '/inside-studio/3.jpg', width: 2592, height: 4608 },
  { src: '/inside-studio/4.jpg', width: 2048, height: 1536 },
  { src: '/inside-studio/5.jpg', width: 2048, height: 1536 },
  { src: '/inside-studio/6.jpg', width: 1327, height: 2880 },
  { src: '/inside-studio/7.jpg', width: 2736, height: 3648 },
  { src: '/inside-studio/8.jpg', width: 2000, height: 1500 },
  { src: '/inside-studio/9.jpg', width: 1390, height: 3015 },
  { src: '/inside-studio/10.jpg', width: 1920, height: 1080 },
]

export function InsideStudioStrip() {
  // Duplicate so the -50% translateX loop is seamless
  const track = [...PHOTOS, ...PHOTOS]

  return (
    <section className="bg-black py-16 overflow-hidden">
      <div className="px-6 mb-8">
        <p className="font-sans text-xs font-medium tracking-[0.09em] uppercase text-white/50 mb-2">
          Real sessions, real gear
        </p>
        <h2 className="font-display text-4xl sm:text-5xl uppercase text-white leading-none">
          Inside the Studio
        </h2>
      </div>

      <div className="flex overflow-hidden">
        <div
          className="flex shrink-0 gap-4 pr-4 motion-safe:animate-marquee"
          style={{ animationDuration: `${PHOTOS.length * 9}s` }}
        >
          {track.map((photo, i) => (
            <div
              key={i}
              className="relative h-72 sm:h-96 shrink-0 grayscale-[40%] hover:grayscale-0 transition-[filter] duration-500"
              style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
            >
              <Image
                src={photo.src}
                alt=""
                fill
                className="object-cover"
                sizes="500px"
                loading={i < PHOTOS.length ? 'eager' : 'lazy'}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
