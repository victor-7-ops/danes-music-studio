import { redirect } from 'next/navigation'
import SlotGridStep from '@/components/booking/SlotGridStep'
import { createClient } from '@/lib/supabase/server'
import { SERVICES, isServiceSlug } from '@/lib/services'

// 9 AM through 9 PM (hour 21 = 9 PM slot, ends at 10 PM)
const ALL_SLOT_HOURS: number[] = Array.from({ length: 13 }, (_, i) => i + 9)

interface PageProps {
  searchParams: Promise<{ date?: string; service?: string }>
}

export default async function SlotsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const date = params.date
  const service = params.service ?? 'rehearsal'

  if (!date || !isServiceSlug(service)) {
    redirect('/book')
  }

  const supabase = await createClient()
  const { data: serviceType } = await supabase
    .from('service_types')
    .select('rate_per_hour, deposit_pct')
    .eq('name', SERVICES[service].name)
    .eq('active', true)
    .single()

  if (!serviceType) {
    redirect('/book')
  }

  const baseUrl = process.env.NEXT_PUBLIC_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/availability?date=${date}`, {
    cache: 'no-store',
  })

  const slots: Array<{ startAt: string; endAt: string }> = res.ok
    ? await res.json()
    : []

  return (
    <SlotGridStep
      date={date}
      service={service}
      rateCents={serviceType.rate_per_hour}
      depositPct={serviceType.deposit_pct}
      slots={slots}
      allSlotHours={ALL_SLOT_HOURS}
    />
  )
}
