import Link from 'next/link'

export default function BookPage() {
  return (
    <main className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 py-16">
      <span className="font-sans text-xs uppercase tracking-widest text-muted mb-4">
        Step 1 of 4
      </span>

      <h1 className="font-display text-5xl uppercase text-ink mb-6">
        Pick a Date
      </h1>

      <p className="font-sans text-sm text-muted mb-8">
        Date picker coming in plan 02-02.
      </p>

      <Link href="/" className="font-sans text-sm text-muted underline">
        Back
      </Link>
    </main>
  )
}
