// Pure function — no Supabase imports, no DB calls.
// Algorithm: CLAUDE.md invariant 5 (default hours → special_hours → blocks → active bookings)
// Philippines is UTC+8 year-round (no DST); slot times constructed via +08:00 ISO strings.

export interface TimeSlot {
  startAt: Date
  endAt: Date
  durationMinutes: 60
}

export interface DateRange {
  startAt: Date
  endAt: Date
}

export interface SpecialHours {
  date: string
  openTime: string | null
  closeTime: string | null
  closed: boolean
}

export interface Settings {
  operatingOpen: string   // "HH:MM" wall-clock, e.g. "09:00"
  operatingClose: string  // "HH:MM" wall-clock, e.g. "22:00"
  holdWindowMinutes: number
}

export function getAvailableSlots(params: {
  date: string              // "YYYY-MM-DD" in Asia/Manila calendar date
  bookings: DateRange[]     // CALLER pre-filters: confirmed + non-expired pending only
  blockedSlots: DateRange[]
  specialHours?: SpecialHours | null
  settings: Settings
}): TimeSlot[] {
  // Step 1: If closed → return empty
  if (params.specialHours?.closed) return []

  // Step 2: Determine operating window
  const openTime  = params.specialHours?.openTime  ?? params.settings.operatingOpen
  const closeTime = params.specialHours?.closeTime ?? params.settings.operatingClose

  // Step 3: Generate whole-hour slots (Philippines UTC+8, no DST)
  const slots = generateHourSlots(params.date, openTime, closeTime)

  // Steps 4–5: Filter out blocked and booked slots
  return slots.filter(
    slot =>
      !overlapsAny(slot, params.blockedSlots) &&
      !overlapsAny(slot, params.bookings)
  )
}

/**
 * Generate one-hour slots from openTime to closeTime on the given date (Asia/Manila).
 * Uses +08:00 ISO string construction — no hand-rolled DST logic needed.
 */
function generateHourSlots(date: string, openTime: string, closeTime: string): TimeSlot[] {
  const [openH] = openTime.split(':').map(Number) as [number]
  const [closeH] = closeTime.split(':').map(Number) as [number]
  const slots: TimeSlot[] = []
  for (let h = openH; h < closeH; h++) {
    const hh     = String(h).padStart(2, '0')
    const hh1    = String(h + 1).padStart(2, '0')
    const startAt = new Date(`${date}T${hh}:00:00+08:00`)
    const endAt   = new Date(`${date}T${hh1}:00:00+08:00`)
    slots.push({ startAt, endAt, durationMinutes: 60 })
  }
  return slots
}

/**
 * Half-open interval overlap check matching tstzrange '[)' semantics:
 * slot.startAt < range.endAt && slot.endAt > range.startAt
 */
function overlapsAny(slot: TimeSlot, ranges: DateRange[]): boolean {
  return ranges.some(r => slot.startAt < r.endAt && slot.endAt > r.startAt)
}
