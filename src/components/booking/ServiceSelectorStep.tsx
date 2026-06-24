'use client'

import { useRouter } from 'next/navigation'

const services = [
  { label: 'Rehearsal', rate: '₱350/hr', param: 'rehearsal' },
  { label: 'Recording', rate: '₱1,000/hr', param: 'recording' },
]

export default function ServiceSelectorStep() {
  const router = useRouter()

  return (
    <>
      <span className="font-sans text-xs uppercase tracking-widest text-muted mb-4">
        Step 1 of 5
      </span>
      <h1 className="font-display text-5xl uppercase text-ink mb-8">
        Book a Session
      </h1>
      <div className="flex flex-row gap-4">
        {services.map((svc) => (
          <button
            key={svc.param}
            onClick={() => router.push(`/book?service=${svc.param}`)}
            className="border border-ink/20 p-6 flex flex-col gap-4 text-left hover:border-ink/50 transition-colors"
          >
            <span className="font-display uppercase text-ink text-xl">
              {svc.label}
            </span>
            <span className="font-sans text-sm text-muted">{svc.rate}</span>
          </button>
        ))}
      </div>
    </>
  )
}
