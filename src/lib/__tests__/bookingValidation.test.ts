import { describe, expect, it } from 'vitest'
import { validateBookingInput, weeklyDates } from '../bookingValidation'

const valid = {
  date: '2030-02-28', start: '10:00', end: '12:00', service: 'rehearsal',
  payment: 'deposit', contactName: 'Jane Doe', email: 'jane@example.com',
  phone: '09171234567', bandName: '', equipmentIds: [],
}

describe('booking runtime validation', () => {
  it('accepts a real future booking with whole-hour boundaries', () => {
    expect(validateBookingInput(valid)).toBe(true)
  })
  it.each([
    { date: '2030-02-30' },
    { date: '2000-01-01' },
    { start: '10:30' },
    { end: '12:45' },
    { payment: 'cash' },
    { equipmentIds: ['not-a-uuid'] },
  ])('rejects malformed values before the database boundary: %o', change => {
    expect(validateBookingInput({ ...valid, ...change })).toBe(false)
  })
  it('derives weekly occurrences with calendar arithmetic', () => {
    expect(weeklyDates('2030-02-28', 3)).toEqual(['2030-02-28', '2030-03-07', '2030-03-14'])
  })
})
