import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/gcal/pushSync', () => ({ pushGcalEvent: vi.fn(), deleteGcalEvent: vi.fn() }))
vi.mock('@/lib/emails/confirm', () => ({ sendConfirmEmail: vi.fn() }))
vi.mock('@/lib/emails/cancel', () => ({ sendCancelEmail: vi.fn() }))
import { createClient } from '@/lib/supabase/server'
import { pushGcalEvent, deleteGcalEvent } from '@/lib/gcal/pushSync'
import { sendConfirmEmail } from '@/lib/emails/confirm'
import { retryBookingDelivery } from '@/lib/actions/admin/retryBookingDelivery'
import { makeMockClient } from './supabaseMock'

describe('retryBookingDelivery', () => {
  beforeEach(() => vi.resetAllMocks())
  function booking(status = 'confirmed', email = 'studio@example.com') {
    const client = makeMockClient({ bookings: [{ data: { id: 'id', status, customer_email: email, gcal_event_id: 'event' }, error: null }] })
    vi.mocked(createClient).mockResolvedValue(client as never)
    return client
  }
  it('rejects a non-admin without reading bookings', async () => {
    const client = makeMockClient({}, { user: { id: 'user', app_metadata: { role: 'customer' } } })
    vi.mocked(createClient).mockResolvedValue(client as never)
    expect(await retryBookingDelivery('id', 'calendar')).toEqual({ success: false, error: 'Unauthorized' })
    expect(client.from).not.toHaveBeenCalled()
  })
  it('does not sync a pending booking', async () => {
    booking('pending')
    expect((await retryBookingDelivery('id', 'calendar')).success).toBe(false)
    expect(pushGcalEvent).not.toHaveBeenCalled()
  })
  it('reports a disconnected calendar', async () => {
    booking()
    vi.mocked(pushGcalEvent).mockResolvedValue(false)
    expect((await retryBookingDelivery('id', 'calendar')).success).toBe(false)
  })
  it('removes the event for a cancelled booking', async () => {
    booking('cancelled')
    vi.mocked(deleteGcalEvent).mockResolvedValue(true)
    expect(await retryBookingDelivery('id', 'calendar')).toEqual({ success: true })
    expect(deleteGcalEvent).toHaveBeenCalledWith('event')
  })
  it('reports delivery errors without claiming success', async () => {
    booking()
    vi.mocked(sendConfirmEmail).mockRejectedValue(new Error('provider error'))
    expect((await retryBookingDelivery('id', 'email')).success).toBe(false)
  })
  it('does not send without a recipient', async () => {
    booking('confirmed', '')
    expect((await retryBookingDelivery('id', 'email')).success).toBe(false)
    expect(sendConfirmEmail).not.toHaveBeenCalled()
  })
})
