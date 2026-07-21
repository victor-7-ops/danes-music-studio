import { redirect } from 'next/navigation'
import Link from 'next/link'
import { DmsHero } from '@/components/DmsHero'

interface PageProps {
  searchParams: Promise<{
    codes?: string
  }>
}

// Lightweight summary shown after a recurring series is created (Option B —
// per-occurrence payment, plan 031). Unlike the single-booking /book/confirm
// page, N confirmation codes now exist instead of one, so this doesn't try
// to shoehorn them through the existing single-code book/pay?code=... URL
// shape — each code links to the existing, unmodified /book/pay flow.
export default async function SeriesConfirmPage({ searchParams }: PageProps) {
  const params = await searchParams
  const codesParam = params.codes

  if (!codesParam) {
    redirect('/book')
  }

  const codes = codesParam.split(',').filter(Boolean)

  if (codes.length === 0) {
    redirect('/book')
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-8">
        <DmsHero dark />
      </div>

      <h1 className="font-display text-6xl uppercase text-ink mb-4">
        Series Booked
      </h1>

      <p className="font-sans text-muted mb-8 max-w-md">
        Your {codes.length}-week recurring booking is reserved. Each session
        is held separately — pay for each one as it approaches using its own
        confirmation code below.
      </p>

      <div className="w-full max-w-sm border border-border divide-y divide-border mb-10 text-left">
        {codes.map((code, i) => (
          <div key={code} className="flex justify-between items-center px-4 py-3">
            <span className="font-sans text-xs uppercase tracking-widest text-muted">
              Week {i + 1}
            </span>
            <Link
              href={`/book/pay?code=${code}`}
              className="font-display text-lg text-ink tracking-widest hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
            >
              {code}
            </Link>
          </div>
        ))}
      </div>

      <Link
        href="/"
        className="font-sans text-sm text-muted underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
      >
        Back to home
      </Link>
    </div>
  )
}
