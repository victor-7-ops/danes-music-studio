import Image from 'next/image'

interface Photo {
  src: string
  width: number
  height: number
}

// Native pixel dimensions — used to size each card correctly instead of
// letting the browser guess (avoids layout shift, keeps aspect ratio right
// since 6.png is portrait and the rest are landscape).
const ROW_1: Photo[] = [
  { src: '/feature-wall/1.png', width: 3508, height: 2480 },
  { src: '/feature-wall/2.png', width: 3508, height: 2480 },
  { src: '/feature-wall/3.png', width: 3508, height: 2480 },
  { src: '/feature-wall/4.png', width: 3508, height: 2480 },
]
const ROW_2: Photo[] = [
  { src: '/feature-wall/5.png', width: 3508, height: 2480 },
  { src: '/feature-wall/6.png', width: 2480, height: 3508 },
  { src: '/feature-wall/7.png', width: 3508, height: 2480 },
]

function MarqueeRow({ photos, reverse }: { photos: Photo[]; reverse?: boolean }) {
  // Duplicate the row so a -50% translateX loop is seamless
  const track = [...photos, ...photos]
  return (
    <div className="flex overflow-hidden">
      <div
        className={`flex shrink-0 gap-4 pr-4 ${reverse ? 'motion-safe:animate-marquee-reverse' : 'motion-safe:animate-marquee'}`}
      >
        {track.map((photo, i) => (
          <div
            key={i}
            className="relative h-40 sm:h-56 shrink-0"
            style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
          >
            <Image
              src={photo.src}
              alt=""
              fill
              className="object-cover"
              sizes="400px"
              priority={i < photos.length}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export function FeatureWallMarquee() {
  return (
    <div className="absolute inset-0 flex flex-col justify-center gap-4 opacity-70">
      <MarqueeRow photos={ROW_1} />
      <MarqueeRow photos={ROW_2} reverse />
    </div>
  )
}
