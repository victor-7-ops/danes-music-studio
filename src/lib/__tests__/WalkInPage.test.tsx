// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
vi.mock('@/lib/actions/admin/createWalkIn', () => ({ createWalkIn: vi.fn() }))
import { createWalkIn } from '@/lib/actions/admin/createWalkIn'
import WalkInPage from '@/app/admin/walk-in/page'
afterEach(cleanup)
it('names every walk-in field and announces incomplete submission', () => {
  render(<WalkInPage />)
  for (const name of ['Date', 'Start Time', 'End Time', 'Band Name']) {
    expect(screen.getByLabelText(name)).toBeTruthy()
  }
  fireEvent.click(screen.getByRole('button', { name: 'Book Walk-In' }))
  expect(screen.getByRole('alert').textContent).toContain('Please fill in')
  expect(createWalkIn).not.toHaveBeenCalled()
})
