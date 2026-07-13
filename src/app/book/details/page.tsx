import { redirect } from 'next/navigation'
import DetailsForm from '@/components/booking/DetailsForm'
import { createClient } from '@/lib/supabase/server'
import { SERVICES, isServiceSlug } from '@/lib/services'
import { getUnavailableEquipment } from '@/lib/equipmentAvailability'

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
      .select('id, name, price_per_session, quantity')
      .eq('active', true)
      .order('sort_order'),
  ])

  if (!serviceType) {
    redirect('/book')
  }

  // Surface equipment conflicts for the selected time slot before checkout,
  // rather than only rejecting at submit time in createBooking. Mirrors
  // createBooking's own conflict check (src/lib/equipmentAvailability.ts) —
  // non-cancelled bookings only, same overlap semantics.
  let unavailableEquipmentIds: string[] = []
  if (equipment && equipment.length > 0) {
    const { data: usageRows } = await supabase
      .from('booking_equipment')
      .select('equipment_id, bookings!inner(status, start_at, end_at)')
      .in(
        'equipment_id',
        equipment.map(item => item.id)
      )
      .neq('bookings.status', 'cancelled')

    const existingUsage = (usageRows ?? []).map(row => {
      const booking = Array.isArray(row.bookings) ? row.bookings[0] : row.bookings
      return {
        equipmentId: row.equipment_id as string,
        startAt: new Date(booking.start_at as string),
        endAt: new Date(booking.end_at as string),
      }
    })

    const start_at = `${date}T${start}:00+08:00`
    const end_at = `${date}T${end}:00+08:00`

    unavailableEquipmentIds = getUnavailableEquipment(
      equipment.map(item => ({ id: item.id, name: item.name, quantity: item.quantity })),
      existingUsage,
      new Date(start_at),
      new Date(end_at)
    ).map(item => item.id)
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
        unavailableEquipmentIds={unavailableEquipmentIds}
      />
    </div>
  )
}
