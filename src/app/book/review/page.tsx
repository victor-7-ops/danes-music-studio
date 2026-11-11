import { redirect } from 'next/navigation'
import ReviewPage from '@/components/booking/ReviewPage'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/serviceClient'
import { SERVICES, isServiceSlug } from '@/lib/services'
import { quoteVoucher } from '@/lib/actions/voucherQuote'

interface PageProps {
  searchParams: Promise<{
    date?: string
    start?: string
    end?: string
    payment?: string
    service?: string
    name?: string
    email?: string
    phone?: string
    band?: string
    equipment?: string
    voucher?: string
  }>
}

export default async function ReviewServerPage({ searchParams }: PageProps) {
  const params = await searchParams
  const { date, start, end, payment, name, email, phone, band, equipment, voucher } = params
  const service = params.service ?? 'rehearsal'

  if (!date || !start || !end || !payment || !name || !email || !phone || !isServiceSlug(service)) {
    redirect('/book')
  }

  if (payment !== 'full' && payment !== 'deposit') {
    redirect('/book')
  }

  const equipmentIds = equipment ? equipment.split(',').filter(Boolean) : []

  const supabase = await createClient()
  const [{ data: serviceType }, { data: selectedEquipment }, { data: settingsRow }] = await Promise.all([
    supabase
      .from('service_types')
      .select('rate_per_hour, deposit_pct')
      .eq('name', SERVICES[service].name)
      .eq('active', true)
      .single(),
    equipmentIds.length > 0
      ? supabase
          .from('equipment')
          .select('id, name, price_per_session')
          .in('id', equipmentIds)
          .eq('active', true)
      : Promise.resolve({ data: [] }),
    // settings is admin-only RLS — service client bypasses it for this
    // public, read-only terms-and-conditions text.
    createServiceClient().from('settings').select('terms_and_conditions').single(),
  ])
  const termsAndConditions = settingsRow?.terms_and_conditions ?? ''

  if (!serviceType) {
    redirect('/book')
  }

  const contactName = decodeURIComponent(name)
  const decodedEmail = decodeURIComponent(email)
  const decodedPhone = decodeURIComponent(phone)
  const bandName = band ? decodeURIComponent(band) : ''

  let voucherDiscountCents = 0
  if (voucher) {
    const hours = parseInt(end.slice(0, 2)) - parseInt(start.slice(0, 2))
    const equipmentCents = (selectedEquipment ?? []).reduce((sum, item) => sum + item.price_per_session, 0)
    const quote = await quoteVoucher({
      code: voucher,
      service,
      sessionDate: date,
      studioSubtotalCents: hours * serviceType.rate_per_hour,
      equipmentSubtotalCents: equipmentCents,
      email: decodedEmail,
    })
    if (quote.valid) voucherDiscountCents = quote.discountCents
  }

  return (
    <div className="min-h-screen bg-bg px-6 py-16">
      <ReviewPage
        date={date}
        start={start}
        end={end}
        payment={payment as 'full' | 'deposit'}
        service={service}
        serviceLabel={SERVICES[service].label}
        rateCents={serviceType.rate_per_hour}
        depositPct={serviceType.deposit_pct}
        contactName={contactName}
        email={decodedEmail}
        phone={decodedPhone}
        bandName={bandName}
        equipment={selectedEquipment ?? []}
        voucherCode={voucher ?? undefined}
        voucherDiscountCents={voucherDiscountCents}
        termsAndConditions={termsAndConditions}
      />
    </div>
  )
}
