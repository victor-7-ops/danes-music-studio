import { describe, it, expect } from 'vitest'
import { getUnavailableEquipment, type EquipmentItem, type EquipmentUsage } from '../equipmentAvailability'

const amp: EquipmentItem = { id: 'amp-1', name: 'Guitar Amp', quantity: 1 }
const mic: EquipmentItem = { id: 'mic-1', name: 'Extra Mic', quantity: 2 }

const target = {
  start: new Date('2026-08-01T02:00:00Z'), // 10:00 Manila
  end: new Date('2026-08-01T04:00:00Z'), // 12:00 Manila
}

function usage(equipmentId: string, startIso: string, endIso: string): EquipmentUsage {
  return { equipmentId, startAt: new Date(startIso), endAt: new Date(endIso) }
}

describe('getUnavailableEquipment', () => {
  it('quantity=1 rejects a second overlapping booking of the same equipment', () => {
    const existingUsage = [usage('amp-1', '2026-08-01T02:30:00Z', '2026-08-01T03:30:00Z')]
    const result = getUnavailableEquipment([amp], existingUsage, target.start, target.end)
    expect(result.map(i => i.id)).toEqual(['amp-1'])
  })

  it('quantity=1 allows booking when no existing overlapping usage', () => {
    const existingUsage: EquipmentUsage[] = []
    const result = getUnavailableEquipment([amp], existingUsage, target.start, target.end)
    expect(result).toEqual([])
  })

  it('quantity=2 allows exactly 2 concurrent bookings', () => {
    const existingUsage = [
      usage('mic-1', '2026-08-01T02:30:00Z', '2026-08-01T03:30:00Z'),
    ]
    // one existing overlapping usage + this request = 2 total, at capacity but not exceeding
    // the "existing" count only counts OTHER bookings, so 1 existing < quantity 2 → available
    const result = getUnavailableEquipment([mic], existingUsage, target.start, target.end)
    expect(result).toEqual([])
  })

  it('quantity=2 rejects a 3rd concurrent booking', () => {
    const existingUsage = [
      usage('mic-1', '2026-08-01T02:30:00Z', '2026-08-01T03:30:00Z'),
      usage('mic-1', '2026-08-01T02:15:00Z', '2026-08-01T03:00:00Z'),
    ]
    const result = getUnavailableEquipment([mic], existingUsage, target.start, target.end)
    expect(result.map(i => i.id)).toEqual(['mic-1'])
  })

  it('non-overlapping times never conflict regardless of quantity', () => {
    // existing usage ends before target starts
    const existingUsage = [usage('amp-1', '2026-08-01T00:00:00Z', '2026-08-01T02:00:00Z')]
    const result = getUnavailableEquipment([amp], existingUsage, target.start, target.end)
    expect(result).toEqual([])
  })

  it('cancelled bookings do not count toward conflicts (caller must pre-filter them out)', () => {
    // Simulates the caller already having excluded cancelled bookings from
    // existingUsage — passing an empty array here is what that filtering
    // produces for a cancelled overlapping booking.
    const existingUsage: EquipmentUsage[] = []
    const result = getUnavailableEquipment([amp], existingUsage, target.start, target.end)
    expect(result).toEqual([])
  })

  it('adjacent (touching) ranges do not conflict — half-open interval semantics', () => {
    // existing usage ends exactly when target starts
    const existingUsage = [usage('amp-1', '2026-08-01T00:00:00Z', target.start.toISOString())]
    const result = getUnavailableEquipment([amp], existingUsage, target.start, target.end)
    expect(result).toEqual([])
  })

  it('multiple requested items are evaluated independently', () => {
    const existingUsage = [usage('amp-1', '2026-08-01T02:30:00Z', '2026-08-01T03:30:00Z')]
    const result = getUnavailableEquipment([amp, mic], existingUsage, target.start, target.end)
    expect(result.map(i => i.id)).toEqual(['amp-1'])
  })
})
