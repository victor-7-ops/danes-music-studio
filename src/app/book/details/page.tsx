import { redirect } from 'next/navigation'
import DetailsForm from '@/components/booking/DetailsForm'
import { createClient } from '@/lib/supabase/server'
import { SERVICES, isServiceSlug } from '@/lib/services'

interface PageProps {
  searchParams: Promise<{ date?: string; start?: string; end?: string; payment?: string; service?: string; equipment?: string }>
}

export default async function DetailsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const { date, start, end, payment, equipment: equipmentParam } = params
  const service = params.service ?? 'rehearsal'
  const initialEquipmentIds = equipmentParam ? equipmentParam.split(',').filter(Boolean) : []

  if (!date || !start || !end || !payment || !isServiceSlug(service)) {
    redirect('/book')
  }

  if (payment !== 'full' && payment !== 'deposit') {
    redirect('/book')
  }

  const supabase = await createClient()
  const [{ data: serviceType }, { data: equipment }] = await Promise.all([
    supabase
      .from('service_types')
      .select('rate_per_hour, deposit_pct')
      .eq('name', SERVICES[service].name)
      .eq('active', true)
      .single(),
    supabase
      .from('equipment')
      .select('id, name, price_per_session')
      .eq('active', true)
      .order('sort_order'),
  ])

  if (!serviceType) {
    redirect('/book')
  }

  return (
    <div className="min-h-screen bg-bg px-6 py-16">
      <DetailsForm
        date={date}
        start={start}
        end={end}
        payment={payment as 'full' | 'deposit'}
        service={service}
        rateCents={serviceType.rate_per_hour}
        depositPct={serviceType.deposit_pct}
        equipment={equipment ?? []}
        initialEquipmentIds={initialEquipmentIds}
      />
    </div>
  )
}
