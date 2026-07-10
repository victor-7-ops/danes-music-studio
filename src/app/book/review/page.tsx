import { redirect } from 'next/navigation'
import ReviewPage from '@/components/booking/ReviewPage'
import { createClient } from '@/lib/supabase/server'
import { SERVICES, isServiceSlug } from '@/lib/services'

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
  }>
}

export default async function ReviewServerPage({ searchParams }: PageProps) {
  const params = await searchParams
  const { date, start, end, payment, name, email, phone, band, equipment } = params
  const service = params.service ?? 'rehearsal'

  if (!date || !start || !end || !payment || !name || !email || !phone || !isServiceSlug(service)) {
    redirect('/book')
  }

  if (payment !== 'full' && payment !== 'deposit') {
    redirect('/book')
  }

  const equipmentIds = equipment ? equipment.split(',').filter(Boolean) : []

  const supabase = await createClient()
  const [{ data: serviceType }, { data: selectedEquipment }] = await Promise.all([
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
  ])

  if (!serviceType) {
    redirect('/book')
  }

  const contactName = decodeURIComponent(name)
  const decodedEmail = decodeURIComponent(email)
  const decodedPhone = decodeURIComponent(phone)
  const bandName = band ? decodeURIComponent(band) : ''

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
      />
    </div>
  )
}
