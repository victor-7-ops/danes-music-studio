import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAvailableSlots } from '@/lib/availability'
import type { DateRange, SpecialHours, Settings } from '@/lib/availability'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')

  if (!date || !DATE_RE.test(date)) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
  }

  const supabase = await createClient()

  const [bookingsRes, blockedRes, specialRes, settingsRes] = await Promise.all([
    supabase
      .from('bookings')
      .select('start_at, end_at, status, hold_expires_at')
      .in('status', ['confirmed', 'pending'])
      .gte('end_at', `${date}T00:00:00+08:00`)
      .lte('start_at', `${date}T23:59:59+08:00`),

    supabase
      .from('blocked_slots')
      .select('start_at, end_at')
      .gte('end_at', `${date}T00:00:00+08:00`)
      .lte('start_at', `${date}T23:59:59+08:00`),

    supabase
      .from('special_hours')
      .select('date, open_time, close_time, closed')
      .eq('date', date)
      .maybeSingle(),

    supabase
      .from('settings')
      .select('operating_open, operating_close, hold_window_minutes')
      .single(),
  ])

  if (bookingsRes.error) {
    console.error('bookings query error:', bookingsRes.error)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
  if (blockedRes.error) {
    console.error('blocked_slots query error:', blockedRes.error)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
  if (specialRes.error) {
    console.error('special_hours query error:', specialRes.error)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
  if (settingsRes.error) {
    console.error('settings query error:', settingsRes.error)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  // Filter bookings: confirmed always, pending only if hold has not expired
  const now = new Date().toISOString()
  const activeBookings: DateRange[] = (bookingsRes.data ?? [])
    .filter(row => {
      if (row.status === 'confirmed') return true
      if (row.status === 'pending') {
        return row.hold_expires_at != null && row.hold_expires_at > now
      }
      return false
    })
    .map(row => ({
      startAt: new Date(row.start_at),
      endAt: new Date(row.end_at),
    }))

  const blockedSlots: DateRange[] = (blockedRes.data ?? []).map(row => ({
    startAt: new Date(row.start_at),
    endAt: new Date(row.end_at),
  }))

  const specialHoursRow = specialRes.data
  const specialHours: SpecialHours | null = specialHoursRow
    ? {
        date: specialHoursRow.date,
        openTime: specialHoursRow.open_time,
        closeTime: specialHoursRow.close_time,
        closed: specialHoursRow.closed,
      }
    : null

  const settingsRow = settingsRes.data
  const settings: Settings = {
    operatingOpen: settingsRow.operating_open,
    operatingClose: settingsRow.operating_close,
    holdWindowMinutes: settingsRow.hold_window_minutes,
  }

  const slots = getAvailableSlots({
    date,
    bookings: activeBookings,
    blockedSlots,
    specialHours,
    settings,
  })

  return NextResponse.json(slots)
}
