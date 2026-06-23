// TODO Phase 3: read rate from service_types

/**
 * Returns true if candidateHour can be added to (or removed from) selectedStartHours
 * while keeping the selection contiguous.
 *
 * Rules:
 *  - Empty selection → always contiguous (first pick)
 *  - Candidate already in selection → true (deselect path)
 *  - Candidate is adjacent to min or max of current block → contiguous
 *  - Otherwise → not contiguous
 */
export function isContiguous(
  selectedStartHours: number[],
  candidateHour: number
): boolean {
  if (selectedStartHours.length === 0) return true
  if (selectedStartHours.includes(candidateHour)) return true

  const min = Math.min(...selectedStartHours)
  const max = Math.max(...selectedStartHours)

  return candidateHour === min - 1 || candidateHour === max + 1
}

/**
 * Computes total and deposit in centavos.
 * depositCents = Math.floor(totalCents / 2) — integer division, never float.
 */
export function computeTotal(
  slotCount: number,
  rateCents: number
): { totalCents: number; depositCents: number } {
  const totalCents = slotCount * rateCents
  const depositCents = Math.floor(totalCents / 2)
  return { totalCents, depositCents }
}
