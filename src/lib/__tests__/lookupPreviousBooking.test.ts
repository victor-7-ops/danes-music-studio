import { describe, it, expect } from 'vitest'
import {
  EMPTY_LOOKUP_RESULT,
  InMemoryRateLimiter,
  normalizeLookupInput,
  toLookupResult,
} from '../lookupPreviousBooking'

describe('normalizeLookupInput', () => {
  it('trims and returns email+phone when both present', () => {
    expect(normalizeLookupInput('  a@b.com ', ' 555-1234 ')).toEqual({
      email: 'a@b.com',
      phone: '555-1234',
    })
  })

  it('does NOT lowercase — must match createBooking.ts storage (.trim() only)', () => {
    expect(normalizeLookupInput('Mixed@Case.com', '555-1234')).toEqual({
      email: 'Mixed@Case.com',
      phone: '555-1234',
    })
  })

  it('returns null when email missing', () => {
    expect(normalizeLookupInput(undefined, '555-1234')).toBeNull()
  })

  it('returns null when phone missing', () => {
    expect(normalizeLookupInput('a@b.com', undefined)).toBeNull()
  })

  it('returns null when email is only whitespace', () => {
    expect(normalizeLookupInput('   ', '555-1234')).toBeNull()
  })

  it('returns null when fields are non-string types', () => {
    expect(normalizeLookupInput(123, {})).toBeNull()
  })
})

describe('toLookupResult', () => {
  it('returns EMPTY_LOOKUP_RESULT for null/undefined data (no match, or partial match)', () => {
    expect(toLookupResult(null)).toEqual(EMPTY_LOOKUP_RESULT)
    expect(toLookupResult(undefined)).toEqual(EMPTY_LOOKUP_RESULT)
  })

  it('maps band_name + booking_equipment rows to bandName + equipmentIds', () => {
    expect(
      toLookupResult({
        band_name: 'The Midnight',
        booking_equipment: [{ equipment_id: 'eq-1' }, { equipment_id: 'eq-2' }],
      })
    ).toEqual({ bandName: 'The Midnight', equipmentIds: ['eq-1', 'eq-2'] })
  })

  it('handles null booking_equipment as empty array', () => {
    expect(toLookupResult({ band_name: 'Solo Act', booking_equipment: null })).toEqual({
      bandName: 'Solo Act',
      equipmentIds: [],
    })
  })

  it('handles null band_name', () => {
    expect(toLookupResult({ band_name: null, booking_equipment: [] })).toEqual({
      bandName: null,
      equipmentIds: [],
    })
  })
})

describe('InMemoryRateLimiter', () => {
  it('allows up to `limit` requests within the window', () => {
    const limiter = new InMemoryRateLimiter({ limit: 5, windowMs: 60_000 })
    const now = 1_000_000
    for (let i = 0; i < 5; i++) {
      expect(limiter.check('key-a', now + i)).toBe(true)
    }
  })

  it('rejects the 6th request within the window', () => {
    const limiter = new InMemoryRateLimiter({ limit: 5, windowMs: 60_000 })
    const now = 1_000_000
    for (let i = 0; i < 5; i++) {
      limiter.check('key-a', now + i)
    }
    expect(limiter.check('key-a', now + 5)).toBe(false)
  })

  it('allows the 1st request again after the window passes', () => {
    const limiter = new InMemoryRateLimiter({ limit: 5, windowMs: 60_000 })
    const now = 1_000_000
    for (let i = 0; i < 5; i++) {
      limiter.check('key-a', now + i)
    }
    expect(limiter.check('key-a', now + 5)).toBe(false)
    // 60_001ms later — window has fully rolled past all 5 prior hits
    expect(limiter.check('key-a', now + 60_001)).toBe(true)
  })

  it('tracks separate keys independently', () => {
    const limiter = new InMemoryRateLimiter({ limit: 1, windowMs: 60_000 })
    const now = 1_000_000
    expect(limiter.check('key-a', now)).toBe(true)
    expect(limiter.check('key-b', now)).toBe(true)
    expect(limiter.check('key-a', now)).toBe(false)
  })
})
