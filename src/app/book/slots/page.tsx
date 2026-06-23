import { redirect } from 'next/navigation'
import SlotGridStep from '@/components/booking/SlotGridStep'

// 9 AM through 9 PM (hour 21 = 9 PM slot, ends at 10 PM)
const ALL_SLOT_HOURS: number[] = Array.from({ length: 13 }, (_, i) => i + 9)

interface PageProps {
  searchParams: Promise<{ date?: string }>
}

export default async function SlotsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const date = params.date

  if (!date) {
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
      slots={slots}
      allSlotHours={ALL_SLOT_HOURS}
    />
  )
}
