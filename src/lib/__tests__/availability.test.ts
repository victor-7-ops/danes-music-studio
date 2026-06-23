import { describe, it, expect } from 'vitest'
import { getAvailableSlots } from '../availability'

const DEFAULT_SETTINGS = {
  operatingOpen: '09:00',
  operatingClose: '22:00',
  holdWindowMinutes: 15,
}

describe('getAvailableSlots', () => {
  it('returns 13 slots on a normal day (9AM–10PM, no overrides)', () => {
    const slots = getAvailableSlots({
      date: '2024-06-24',
      bookings: [],
      blockedSlots: [],
      settings: DEFAULT_SETTINGS,
    })
    // Hours 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21 = 13 slots
    expect(slots).toHaveLength(13)
  })

  it('returns 0 slots when special_hours.closed = true', () => {
    const slots = getAvailableSlots({
      date: '2024-06-24',
      bookings: [],
      blockedSlots: [],
      specialHours: { date: '2024-06-24', openTime: null, closeTime: null, closed: true },
      settings: DEFAULT_SETTINGS,
    })
    expect(slots).toHaveLength(0)
  })

  it('removes 2 slots overlapping a confirmed 2-hour booking (10AM–12PM Manila)', () => {
    // 10AM Manila = 02:00 UTC, 12PM Manila = 04:00 UTC
    const booking = {
      startAt: new Date('2024-06-24T02:00:00.000Z'),
      endAt: new Date('2024-06-24T04:00:00.000Z'),
    }
    const slots = getAvailableSlots({
      date: '2024-06-24',
      bookings: [booking],
      blockedSlots: [],
      settings: DEFAULT_SETTINGS,
    })
    expect(slots).toHaveLength(11) // 13 - 2
  })

  it('removes 2 slots overlapping a blocked_slot (14:00–16:00 Manila)', () => {
    // 14:00 Manila = 06:00 UTC, 16:00 Manila = 08:00 UTC
    const block = {
      startAt: new Date('2024-06-24T06:00:00.000Z'),
      endAt: new Date('2024-06-24T08:00:00.000Z'),
    }
    const slots = getAvailableSlots({
      date: '2024-06-24',
      bookings: [],
      blockedSlots: [block],
      settings: DEFAULT_SETTINGS,
    })
    expect(slots).toHaveLength(11) // 13 - 2
  })

  it('narrows window to 4 slots with special_hours override (14:00–18:00 Manila)', () => {
    const slots = getAvailableSlots({
      date: '2024-06-24',
      bookings: [],
      blockedSlots: [],
      specialHours: { date: '2024-06-24', openTime: '14:00', closeTime: '18:00', closed: false },
      settings: DEFAULT_SETTINGS,
    })
    // Hours 14, 15, 16, 17 = 4 slots
    expect(slots).toHaveLength(4)
  })

  it('removes slot when caller passes a non-expired pending booking (caller responsibility)', () => {
    // Caller is responsible for pre-filtering; when a non-expired pending booking is included,
    // getAvailableSlots must remove the overlapping slot.
    // 9AM–10AM Manila pending booking (not expired — caller passes it in)
    const pendingBooking = {
      startAt: new Date('2024-06-24T01:00:00.000Z'), // 9AM Manila
      endAt: new Date('2024-06-24T02:00:00.000Z'),   // 10AM Manila
    }
    const slots = getAvailableSlots({
      date: '2024-06-24',
      bookings: [pendingBooking],
      blockedSlots: [],
      settings: DEFAULT_SETTINGS,
    })
    expect(slots).toHaveLength(12) // 13 - 1
  })

  it('does NOT remove slot when caller omits an expired pending booking (caller responsibility)', () => {
    // Expired pending bookings should be filtered OUT by the caller before passing bookings[].
    // This test verifies the contract: when caller passes empty bookings[], all 13 slots are available.
    // The function does not inspect hold_expires_at — that is the caller's responsibility.
    const slots = getAvailableSlots({
      date: '2024-06-24',
      bookings: [], // caller correctly omits expired pending booking
      blockedSlots: [],
      settings: DEFAULT_SETTINGS,
    })
    expect(slots).toHaveLength(13) // 9AM–10PM = 13 slots, none removed
  })
})
