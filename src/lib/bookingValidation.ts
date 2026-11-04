export interface BookingInput {
  date: string
  start: string
  end: string
  service: string
  payment: 'full' | 'deposit'
  contactName: string
  email: string
  phone: string
  bandName: string
  equipmentIds?: string[]
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_RE = /^(\d{2}):00$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function validateBookingInput(value: unknown): value is BookingInput {
  if (!value || typeof value !== 'object') return false
  const p = value as Record<string, unknown>
  if (typeof p.date !== 'string' || typeof p.start !== 'string' || typeof p.end !== 'string') return false
  const match = DATE_RE.exec(p.date)
  if (!match) return false
  const date = new Date(`${p.date}T00:00:00Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== p.date) return false
  if (!TIME_RE.test(p.start) || !TIME_RE.test(p.end)) return false
  const startHour = Number(p.start.slice(0, 2))
  const endHour = Number(p.end.slice(0, 2))
  if (startHour > 23 || endHour > 24 || endHour <= startHour) return false
  const startInstant = new Date(`${p.date}T${p.start}:00+08:00`)
  if (startInstant.getTime() <= Date.now()) return false
  if (p.payment !== 'full' && p.payment !== 'deposit') return false
  if (p.service !== 'rehearsal' && p.service !== 'recording') return false
  if (typeof p.contactName !== 'string' || p.contactName.trim().length < 2 || p.contactName.length > 160) return false
  if (typeof p.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email) || p.email.length > 254) return false
  if (typeof p.phone !== 'string' || p.phone.trim().length < 7 || p.phone.length > 40) return false
  if (typeof p.bandName !== 'string' || p.bandName.length > 160) return false
  if (p.equipmentIds !== undefined && (!Array.isArray(p.equipmentIds) || p.equipmentIds.length > 20 || !p.equipmentIds.every(id => typeof id === 'string' && UUID_RE.test(id)))) return false
  return true
}

export function weeklyDates(date: string, count: number): string[] {
  const [year, month, day] = date.split('-').map(Number)
  return Array.from({ length: count }, (_, index) => {
    const occurrence = new Date(Date.UTC(year, month - 1, day + index * 7))
    return occurrence.toISOString().slice(0, 10)
  })
}
