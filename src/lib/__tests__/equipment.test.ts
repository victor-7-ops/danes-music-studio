import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { createEquipment, updateEquipment, deleteEquipment } from '@/lib/actions/admin/equipment'
import { makeMockClient } from './supabaseMock'

describe('equipment actions', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset()
  })

  describe('createEquipment', () => {
    it('happy path: inserts with trimmed name and default quantity 1', async () => {
      const client = makeMockClient({ equipment: [{ data: null, error: null }] })
      vi.mocked(createClient).mockResolvedValue(client as never)

      const result = await createEquipment({ name: '  Drum Kit  ', pricePerSession: 5000 })

      expect(result).toEqual({ success: true })
      const builder = vi.mocked(client.from).mock.results[0].value
      expect(builder.insert).toHaveBeenCalledWith({
        name: 'Drum Kit',
        price_per_session: 5000,
        quantity: 1,
      })
    })

    it('rejects an empty name without touching the database', async () => {
      const client = makeMockClient({})
      vi.mocked(createClient).mockResolvedValue(client as never)

      const result = await createEquipment({ name: '   ', pricePerSession: 5000 })

      expect(result.success).toBe(false)
      expect(client.from).not.toHaveBeenCalled()
    })

    it.each([
      ['negative price', { name: 'Amp', pricePerSession: -1 }],
      ['non-integer price', { name: 'Amp', pricePerSession: 5000.5 }],
    ])('rejects %s', async (_label, params) => {
      const client = makeMockClient({})
      vi.mocked(createClient).mockResolvedValue(client as never)

      const result = await createEquipment(params)

      expect(result.success).toBe(false)
      expect(client.from).not.toHaveBeenCalled()
    })

    it.each([
      ['quantity 0', 0],
      ['negative quantity', -1],
      ['non-integer quantity', 1.5],
    ])('rejects %s', async (_label, quantity) => {
      const client = makeMockClient({})
      vi.mocked(createClient).mockResolvedValue(client as never)

      const result = await createEquipment({ name: 'Amp', pricePerSession: 5000, quantity })

      expect(result.success).toBe(false)
      expect(client.from).not.toHaveBeenCalled()
    })

    it('requires an authenticated user', async () => {
      const client = makeMockClient({}, { user: null })
      vi.mocked(createClient).mockResolvedValue(client as never)

      const result = await createEquipment({ name: 'Amp', pricePerSession: 5000 })

      expect(result).toEqual({ success: false, error: 'Unauthorized' })
      expect(client.from).not.toHaveBeenCalled()
    })
  })

  describe('updateEquipment', () => {
    it('happy path: updates only provided fields', async () => {
      const client = makeMockClient({ equipment: [{ data: null, error: null }] })
      vi.mocked(createClient).mockResolvedValue(client as never)

      const result = await updateEquipment('eq-1', { pricePerSession: 6000, active: false })

      expect(result).toEqual({ success: true })
      const builder = vi.mocked(client.from).mock.results[0].value
      expect(builder.update).toHaveBeenCalledWith({ price_per_session: 6000, active: false })
      expect(builder.eq).toHaveBeenCalledWith('id', 'eq-1')
    })

    it('rejects quantity boundary values (0, negative, non-integer)', async () => {
      const client = makeMockClient({})
      vi.mocked(createClient).mockResolvedValue(client as never)

      for (const quantity of [0, -1, 2.5]) {
        const result = await updateEquipment('eq-1', { quantity })
        expect(result.success).toBe(false)
      }
      expect(client.from).not.toHaveBeenCalled()
    })

    it('rejects a missing id', async () => {
      const client = makeMockClient({})
      vi.mocked(createClient).mockResolvedValue(client as never)

      const result = await updateEquipment('', { pricePerSession: 100 })

      expect(result).toEqual({ success: false, error: 'Invalid equipment ID.' })
      expect(client.from).not.toHaveBeenCalled()
    })

    it('surfaces a DB error', async () => {
      const client = makeMockClient({ equipment: [{ data: null, error: { message: 'db down' } }] })
      vi.mocked(createClient).mockResolvedValue(client as never)

      const result = await updateEquipment('eq-1', { pricePerSession: 100 })

      expect(result).toEqual({ success: false, error: 'db down' })
    })
  })

  describe('deleteEquipment', () => {
    it('happy path', async () => {
      const client = makeMockClient({ equipment: [{ data: null, error: null }] })
      vi.mocked(createClient).mockResolvedValue(client as never)

      const result = await deleteEquipment('eq-1')

      expect(result).toEqual({ success: true })
      const builder = vi.mocked(client.from).mock.results[0].value
      expect(builder.delete).toHaveBeenCalled()
      expect(builder.eq).toHaveBeenCalledWith('id', 'eq-1')
    })

    it('rejects a missing id without touching the database', async () => {
      const client = makeMockClient({})
      vi.mocked(createClient).mockResolvedValue(client as never)

      const result = await deleteEquipment('')

      expect(result).toEqual({ success: false, error: 'Invalid equipment ID.' })
      expect(client.from).not.toHaveBeenCalled()
    })

    it('requires an authenticated user', async () => {
      const client = makeMockClient({}, { user: null })
      vi.mocked(createClient).mockResolvedValue(client as never)

      const result = await deleteEquipment('eq-1')

      expect(result).toEqual({ success: false, error: 'Unauthorized' })
      expect(client.from).not.toHaveBeenCalled()
    })
  })
})
