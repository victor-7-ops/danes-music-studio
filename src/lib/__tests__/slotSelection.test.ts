import { describe, it, expect } from 'vitest'
import { isContiguous, computeTotal } from '../slotSelection'

describe('isContiguous', () => {
  it('empty selection + any hour → true (first pick)', () => {
    expect(isContiguous([], 10)).toBe(true)
  })

  it('[10] + 11 → true (extend right)', () => {
    expect(isContiguous([10], 11)).toBe(true)
  })

  it('[10] + 12 → false (gap at 11)', () => {
    expect(isContiguous([10], 12)).toBe(false)
  })

  it('[10, 11] + 9 → true (prepend)', () => {
    expect(isContiguous([10, 11], 9)).toBe(true)
  })

  it('[10, 11] + 13 → false (gap at 12)', () => {
    expect(isContiguous([10, 11], 13)).toBe(false)
  })

  it('[10] + 10 → true (deselect path)', () => {
    expect(isContiguous([10], 10)).toBe(true)
  })
})

describe('computeTotal', () => {
  it('2 slots at ₱350 → totalCents 70000, depositCents 35000', () => {
    expect(computeTotal(2, 35000)).toEqual({ totalCents: 70000, depositCents: 35000 })
  })

  it('3 slots at ₱350 → depositCents is Math.floor(105000/2) = 52500', () => {
    expect(computeTotal(3, 35000)).toEqual({ totalCents: 105000, depositCents: 52500 })
  })

  it('2 slots at ₱350 + ₱150 gear add-on → total includes gear, deposit is on the combined total', () => {
    expect(computeTotal(2, 35000, 0.5, 15000)).toEqual({ totalCents: 85000, depositCents: 42500 })
  })

  it('gear add-on defaults to 0 when omitted', () => {
    expect(computeTotal(2, 35000, 0.5)).toEqual({ totalCents: 70000, depositCents: 35000 })
  })
})
