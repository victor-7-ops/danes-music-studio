// Pure function — no Supabase imports, no DB calls.
// Studio owns single units of most gear (equipment.quantity, default 1).
// Given the gear requested for a booking and the existing usage of that gear
// by OTHER non-cancelled bookings, determines which requested items have no
// free unit left for the target time range.
//
// Overlap semantics match bookings_no_overlap / getAvailableSlots: half-open
// interval, '[)' — a booking ending at 14:00 does not block one starting at 14:00.

export interface EquipmentItem {
  id: string
  name: string
  quantity: number
}

export interface EquipmentUsage {
  equipmentId: string
  startAt: Date
  endAt: Date
}

/**
 * Returns the subset of `requested` equipment that is at capacity (no unit
 * free) for the [targetStart, targetEnd) range, given `existingUsage`.
 *
 * CALLER pre-filters existingUsage to non-cancelled bookings only (same
 * convention as getAvailableSlots' `bookings` param) — cancelled bookings
 * must never be passed in.
 */
export function getUnavailableEquipment(
  requested: EquipmentItem[],
  existingUsage: EquipmentUsage[],
  targetStart: Date,
  targetEnd: Date
): EquipmentItem[] {
  return requested.filter(item => {
    const overlappingCount = existingUsage.filter(
      u =>
        u.equipmentId === item.id &&
        u.startAt < targetEnd &&
        u.endAt > targetStart
    ).length
    return overlappingCount >= item.quantity
  })
}
