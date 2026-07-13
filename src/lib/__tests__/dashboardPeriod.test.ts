import { describe, it, expect } from 'vitest'
import { getPreviousPeriod } from '../dashboardPeriod'

describe('getPreviousPeriod', () => {
  it('30-day range → previous 30-day range ending the day before', () => {
    expect(getPreviousPeriod('2026-03-01', '2026-03-30')).toEqual({
      prevFrom: '2026-01-30',
      prevTo: '2026-02-28',
    })
  })

  it('7-day range → previous 7-day range ending the day before', () => {
    expect(getPreviousPeriod('2026-02-08', '2026-02-14')).toEqual({
      prevFrom: '2026-02-01',
      prevTo: '2026-02-07',
    })
  })

  it('single-day range → previous single day', () => {
    expect(getPreviousPeriod('2026-02-10', '2026-02-10')).toEqual({
      prevFrom: '2026-02-09',
      prevTo: '2026-02-09',
    })
  })

  it('range crossing a month boundary → prevTo lands on the last day of the prior month', () => {
    expect(getPreviousPeriod('2026-02-01', '2026-02-07')).toEqual({
      prevFrom: '2026-01-25',
      prevTo: '2026-01-31',
    })
  })
})
