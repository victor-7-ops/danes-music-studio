import { redirect } from 'next/navigation'
import SlotGridStep from '@/components/booking/SlotGridStep'
import { createClient } from '@/lib/supabase/server'
import { SERVICES, isServiceSlug } from '@/lib/services'

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
  const [{ data: serviceType }, { data: settings }, { data: specialHours }] = await Promise.all([supabase
    .from('service_types')
    .select('rate_per_hour, deposit_pct')
    .eq('name', SERVICES[service].name)
    .eq('active', true)
    .single(),
    supabase.from('settings').select('operating_open, operating_close').single(),
    supabase.from('special_hours').select('open_time, close_time, closed').eq('date', date).maybeSingle(),
  ])

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

  const opening = specialHours?.open_time ?? settings?.operating_open ?? '09:00'
  const closing = specialHours?.close_time ?? settings?.operating_close ?? '22:00'
  const openHour = Number(opening.slice(0, 2))
  const closeHour = Number(closing.slice(0, 2))
  const allSlotHours = specialHours?.closed || !Number.isFinite(openHour) || !Number.isFinite(closeHour)
    ? []
    : Array.from({ length: Math.max(0, closeHour - openHour) }, (_, i) => openHour + i)

  return (
    <SlotGridStep
      date={date}
      service={service}
      rateCents={serviceType.rate_per_hour}
      depositPct={serviceType.deposit_pct}
      slots={slots}
      allSlotHours={allSlotHours}
    />
  )
}
