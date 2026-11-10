import { createClient } from '@/lib/supabase/server'
import VoucherManager from '@/components/admin/VoucherManager'

export default async function VouchersPage() {
  const supabase = await createClient()
  const { data: vouchers } = await supabase
    .from('vouchers')
    .select('id, code, percent, enabled, max_redemptions, redemptions_used, expires_at')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-bg text-ink p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="font-display text-3xl">Vouchers</h1>
        <VoucherManager vouchers={vouchers ?? []} />
      </div>
    </div>
  )
}
