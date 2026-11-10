'use client'

import { useState, useTransition } from 'react'
import { upsertVoucher } from '@/lib/actions/admin/upsertVoucher'
import { setVoucherEnabled } from '@/lib/actions/admin/setVoucherEnabled'

interface VoucherRow {
  id: string
  code: string
  percent: number
  enabled: boolean
  max_redemptions: number | null
  redemptions_used: number
  expires_at: string | null
}

const inputClass = 'w-full border border-ink/30 bg-bg px-4 py-3 font-sans text-sm focus:outline-none focus:border-ink'
const labelClass = 'block font-sans text-sm uppercase tracking-widest mb-2'

export default function VoucherManager({ vouchers }: { vouchers: VoucherRow[] }) {
  const [code, setCode] = useState('')
  const [percent, setPercent] = useState(10)
  const [maxDiscount, setMaxDiscount] = useState('')
  const [maxRedemptions, setMaxRedemptions] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleCreate() {
    if (!code.trim() || percent < 1 || percent > 100) {
      setError('Code and a percent between 1 and 100 are required.')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await upsertVoucher({
        code,
        percent,
        maxDiscountCentavos: maxDiscount ? Math.round(Number(maxDiscount) * 100) : null,
        maxRedemptions: maxRedemptions ? Number(maxRedemptions) : null,
      })
      if (result.success) {
        setCode('')
        setPercent(10)
        setMaxDiscount('')
        setMaxRedemptions('')
        window.location.reload()
      } else {
        setError(result.error ?? 'Failed to create voucher.')
      }
    })
  }

  function toggle(id: string, enabled: boolean) {
    startTransition(async () => {
      await setVoucherEnabled(id, enabled)
      window.location.reload()
    })
  }

  return (
    <div className="space-y-8">
      <div className="border border-ink/20 p-4 space-y-4">
        <h2 className="font-display text-lg">New Voucher</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Code</label>
            <input className={inputClass} value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="SUMMER20" />
          </div>
          <div>
            <label className={labelClass}>Percent off studio time</label>
            <input type="number" min={1} max={100} className={inputClass} value={percent} onChange={e => setPercent(Number(e.target.value))} />
          </div>
          <div>
            <label className={labelClass}>Max discount (₱, optional)</label>
            <input type="number" min={0} className={inputClass} value={maxDiscount} onChange={e => setMaxDiscount(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Max redemptions (optional)</label>
            <input type="number" min={1} className={inputClass} value={maxRedemptions} onChange={e => setMaxRedemptions(e.target.value)} />
          </div>
        </div>
        {error && <p role="alert" className="text-red-600 font-sans text-sm">{error}</p>}
        <button
          onClick={handleCreate}
          disabled={isPending}
          className="bg-ink text-bg px-6 py-3 font-sans text-xs uppercase tracking-widest hover:opacity-80 disabled:opacity-50"
        >
          {isPending ? 'Saving...' : 'Create Voucher'}
        </button>
      </div>

      <div className="border border-ink/20 divide-y divide-ink/10">
        {vouchers.length === 0 && <p className="p-4 font-sans text-sm text-muted">No vouchers yet.</p>}
        {vouchers.map(v => (
          <div key={v.id} className="flex items-center justify-between px-4 py-3 gap-4">
            <div>
              <p className="font-display text-lg tracking-widest">{v.code}</p>
              <p className="font-sans text-xs text-muted">
                {v.percent}% off studio time · {v.redemptions_used}{v.max_redemptions ? `/${v.max_redemptions}` : ''} used
                {v.expires_at ? ` · expires ${new Date(v.expires_at).toLocaleDateString('en-PH')}` : ''}
              </p>
            </div>
            <button
              onClick={() => toggle(v.id, !v.enabled)}
              disabled={isPending}
              className={`font-sans text-xs uppercase tracking-widest px-4 py-2 border ${v.enabled ? 'border-ink text-ink hover:bg-ink hover:text-bg' : 'border-ink/30 text-muted'}`}
            >
              {v.enabled ? 'Disable' : 'Enable'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
