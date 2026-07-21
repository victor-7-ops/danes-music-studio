'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { confirmDeposit } from '@/lib/actions/admin/confirmDeposit'
import { formatPHP } from '@/lib/emails/format'

interface BookingPaymentActionProps {
  bookingId: string
  depositAmount: number
  totalAmount: number
}

export function BookingPaymentAction({ bookingId, depositAmount, totalAmount }: BookingPaymentActionProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function confirm(amount: number) {
    setError(null)
    startTransition(async () => {
      const result = await confirmDeposit(bookingId, amount)
      if (result.success) {
        router.refresh()
      } else {
        setError(result.error ?? 'Failed to confirm payment.')
      }
    })
  }

  return (
    <div className="flex flex-col gap-1 items-start">
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => confirm(depositAmount)}
          disabled={isPending}
          className="border border-ink/30 px-2 py-1 min-h-11 text-xs uppercase tracking-widest text-ink hover:bg-ink hover:text-bg transition-colors disabled:opacity-50"
        >
          Confirm deposit ({formatPHP(depositAmount)})
        </button>
        <button
          type="button"
          onClick={() => confirm(totalAmount)}
          disabled={isPending}
          className="bg-ink text-bg px-2 py-1 min-h-11 text-xs uppercase tracking-widest hover:opacity-80 transition-opacity disabled:opacity-50"
        >
          Confirm full ({formatPHP(totalAmount)})
        </button>
      </div>
      {error && (
        <p role="alert" className="font-sans text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
