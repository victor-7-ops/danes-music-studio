import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
import { createClient } from '@/lib/supabase/server'
import { createClosure } from '@/lib/actions/admin/createClosure'

const rpc = vi.fn()
const client = {
  auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'owner', app_metadata: { role: 'admin' } } } })) },
  rpc,
}

describe('createClosure atomic admin RPC', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createClient).mockResolvedValue(client as never)
  })
  it('returns conflicts from the serialized database check', async () => {
    const conflict = { id: 'b1', confirmation_code: 'DMS-X', band_name: null, customer_name: 'A', start_at: '2030-01-01T10:00:00Z', end_at: '2030-01-01T11:00:00Z' }
    rpc.mockResolvedValue({ data: { success: false, requiresConfirmation: true, conflicts: [conflict] }, error: null })
    const result = await createClosure({ startAt: '2030-01-01T10:00:00Z', endAt: '2030-01-01T11:00:00Z' })
    expect(result).toEqual({ success: false, requiresConfirmation: true, conflicts: [conflict] })
    expect(rpc).toHaveBeenCalledWith('create_admin_closure', expect.objectContaining({ p_force: false }))
  })
  it('sends the explicit admin confirmation through the same atomic RPC', async () => {
    rpc.mockResolvedValue({ data: { success: true }, error: null })
    expect(await createClosure({ startAt: '2030-01-01T10:00:00Z', endAt: '2030-01-01T11:00:00Z', force: true })).toEqual({ success: true })
    expect(rpc).toHaveBeenCalledWith('create_admin_closure', expect.objectContaining({ p_force: true }))
  })
})
