// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
vi.mock('@/lib/actions/admin/confirmDeposit', () => ({ confirmDeposit: vi.fn() }))
vi.mock('@/lib/actions/admin/cancelBooking', () => ({ cancelBooking: vi.fn() }))
vi.mock('@/lib/actions/admin/cancelSeries', () => ({ cancelSeries: vi.fn() }))
vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn() }))
import { BookingDrawer } from '@/components/admin/BookingDrawer'
import type { BookingEvent } from '@/components/admin/BookingsCalendar'
import { cancelSeries } from '@/lib/actions/admin/cancelSeries'

it('shows delivery warnings together with a partial series cancellation failure', async () => {
  const warning = 'DMS-AFFECTED: Calendar removal failed. Retry from the booking actions.'
  vi.mocked(cancelSeries).mockResolvedValue({ success: false, cancelled: 1, failed: ['b2'], warning })
  const booking: BookingEvent = {
    id: 'b1', title: 'Test', service_type_name: 'Rehearsal',
    start: new Date('2030-08-01T02:00:00Z'), end: new Date('2030-08-01T03:00:00Z'),
    status: 'confirmed', confirmation_code: 'DMS-AFFECTED', customer_name: 'Test',
    customer_email: 'test@example.com', customer_phone: '09000000000', band_name: null,
    deposit_amount: 17500, amount_paid: 17500, total_amount: 35000, source: 'online',
    payment_proof_url: null, equipment: [], series_id: 'series-1',
  }
  const onMutated = vi.fn()
  const view = render(<BookingDrawer booking={booking} onClose={vi.fn()} onMutated={onMutated} />)
  try {
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Entire Series' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel series' }))
    await waitFor(() => {
      const text = screen.getByRole('alert').textContent
      expect(text).toContain('1 occurrence(s) failed')
      expect(text).toContain(warning)
    })
    expect(onMutated).not.toHaveBeenCalled()
  } finally {
    view.unmount()
  }
})
