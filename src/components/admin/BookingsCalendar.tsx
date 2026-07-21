'use client'

import { useState } from 'react'
import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { BookingDrawer } from '@/components/admin/BookingDrawer'

export interface BookingEvent {
  id: string
  title: string // band_name ?? customer_name
  service_type_name: string
  start: Date
  end: Date
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  confirmation_code: string
  customer_name: string
  customer_email: string
  customer_phone: string
  band_name: string | null
  deposit_amount: number
  amount_paid: number
  total_amount: number
  source: 'online' | 'onsite' | 'walk_in'
  payment_proof_url: string | null
  equipment: { name: string; price: number }[]
  series_id: string | null
}

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: { 'en-US': enUS },
})

const STATUS_STYLES: Record<
  BookingEvent['status'],
  React.CSSProperties
> = {
  confirmed: { backgroundColor: '#0B0B0C', color: '#FAFAF8' },
  pending: {
    backgroundColor: 'transparent',
    color: '#0B0B0C',
    border: '1px solid #6B6B6B',
  },
  completed: { backgroundColor: '#3D3D3D', color: '#FAFAF8' },
  cancelled: { backgroundColor: '#E5E5E5', color: '#9A9A9A' },
}

function eventPropGetter(event: BookingEvent) {
  return { style: STATUS_STYLES[event.status] ?? {} }
}

function EventContent({ event }: { event: BookingEvent }) {
  return (
    <div className="flex flex-col overflow-hidden leading-tight">
      <span className="truncate font-medium">{event.title}</span>
      <span className="truncate text-[10px] uppercase tracking-wide opacity-75">
        {event.service_type_name}
      </span>
    </div>
  )
}

export function BookingsCalendar({
  bookings,
  from,
  to,
}: {
  bookings: BookingEvent[]
  from?: string
  to?: string
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<BookingEvent | null>(null)
  const [view, setView] = useState<'week' | 'month' | 'day'>('week')
  const [date, setDate] = useState(() => (from ? new Date(`${from}T00:00:00`) : new Date()))

  const handleNavigate = (d: Date) => {
    setDate(d)
    const monthFrom = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    const monthTo = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      .toISOString()
      .split('T')[0]
    if (monthFrom !== from || monthTo !== to) {
      router.push(`/admin/calendar?from=${monthFrom}&to=${monthTo}`)
    }
  }

  return (
    <div className="h-full">
      <Calendar
        localizer={localizer}
        events={bookings}
        view={view}
        onView={(v) => setView(v as 'week' | 'month' | 'day')}
        date={date}
        onNavigate={handleNavigate}
        views={['week', 'month', 'day']}
        eventPropGetter={eventPropGetter}
        components={{ event: EventContent }}
        onSelectEvent={(event) => setSelected(event as BookingEvent)}
        style={{ height: 700 }}
        startAccessor="start"
        endAccessor="end"
        min={new Date(0, 0, 0, 9, 0, 0)}
        max={new Date(0, 0, 0, 22, 0, 0)}
      />
      {selected && (
        <BookingDrawer
          booking={selected}
          onClose={() => setSelected(null)}
          onMutated={() => {
            setSelected(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
