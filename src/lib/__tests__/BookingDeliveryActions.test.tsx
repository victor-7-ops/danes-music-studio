// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
vi.mock('@/lib/actions/admin/retryBookingDelivery', () => ({ retryBookingDelivery: vi.fn() }))
import { retryBookingDelivery } from '@/lib/actions/admin/retryBookingDelivery'
import { BookingDeliveryActions } from '@/components/admin/BookingDeliveryActions'

afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

it('keeps delivery recovery unavailable for pending bookings', () => {
  const { container } = render(<BookingDeliveryActions bookingId="booking" status="pending" />)
  expect(container.textContent).toBe('')
})

it('shows an actionable error and re-enables both controls after a failed retry', async () => {
  vi.mocked(retryBookingDelivery).mockResolvedValue({
    success: false,
    error: 'Reconnect Google Calendar in Settings.',
  })
  render(<BookingDeliveryActions bookingId="booking" status="cancelled" />)
  fireEvent.click(screen.getByText('Calendar & email'))
  fireEvent.click(screen.getByRole('button', { name: 'Retry Calendar removal' }))
  expect((await screen.findByRole('alert')).textContent).toContain('Reconnect Google Calendar')
  expect(retryBookingDelivery).toHaveBeenCalledWith('booking', 'calendar')
  expect(
    screen.getAllByRole('button').every((button) => !(button as HTMLButtonElement).disabled)
  ).toBe(true)
})

it('announces successful email delivery separately from failure feedback', async () => {
  vi.mocked(retryBookingDelivery).mockResolvedValue({ success: true })
  render(<BookingDeliveryActions bookingId="booking" status="confirmed" />)
  fireEvent.click(screen.getByText('Calendar & email'))
  fireEvent.click(screen.getByRole('button', { name: 'Resend confirmation email' }))
  await waitFor(() => {
    expect(screen.getByRole('status').textContent).toBe('Email sent.')
  })
  expect(retryBookingDelivery).toHaveBeenCalledWith('booking', 'email')
  expect(screen.queryByRole('alert')).toBeNull()
})
