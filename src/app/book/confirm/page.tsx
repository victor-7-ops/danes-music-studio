import { redirect } from 'next/navigation'
import Link from 'next/link'
import { DmsHero } from '@/components/DmsHero'

interface PageProps {
  searchParams: Promise<{
    code?: string
  }>
}

export default async function ConfirmPage({ searchParams }: PageProps) {
  const params = await searchParams
  const code = params.code

  if (!code) {
    redirect('/book')
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-8">
        <DmsHero />
      </div>

      <h1 className="font-display text-6xl uppercase text-ink mb-4">
        You&apos;re In.
      </h1>

      <p className="font-sans text-muted mb-8">
        Your rehearsal slot is reserved.
      </p>

      <div className="font-display text-4xl text-ink tracking-widest mb-8">
        {code}
      </div>

      <p className="font-sans text-sm text-muted mb-10 max-w-sm">
        We&apos;ve held your slot for 15 minutes. Complete payment to confirm your booking.
      </p>

      <Link
        href={`/book/pay?code=${code}`}
        className="font-sans text-sm uppercase tracking-widest bg-ink text-bg px-6 py-3 hover:opacity-80 transition-opacity mb-6 inline-block"
      >
        Continue to Payment →
      </Link>

      <Link
        href="/"
        className="font-sans text-sm text-muted underline"
      >
        Back to home
      </Link>
    </div>
  )
}
