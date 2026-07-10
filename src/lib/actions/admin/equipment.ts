'use server'

import { createClient } from '@/lib/supabase/server'

export interface CreateEquipmentParams {
  name: string
  pricePerSession: number // integer centavos
}

export async function createEquipment(
  params: CreateEquipmentParams
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const name = params.name.trim()
  if (name.length < 1) return { success: false, error: 'Name is required.' }
  if (!Number.isInteger(params.pricePerSession) || params.pricePerSession < 0) {
    return { success: false, error: 'Price must be a non-negative integer.' }
  }

  const { error } = await supabase
    .from('equipment')
    .insert({ name, price_per_session: params.pricePerSession })

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function updateEquipment(
  id: string,
  params: Partial<CreateEquipmentParams> & { active?: boolean }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  if (!id) return { success: false, error: 'Invalid equipment ID.' }

  const update: { name?: string; price_per_session?: number; active?: boolean } = {}
  if (params.name !== undefined) {
    const name = params.name.trim()
    if (name.length < 1) return { success: false, error: 'Name is required.' }
    update.name = name
  }
  if (params.pricePerSession !== undefined) {
    if (!Number.isInteger(params.pricePerSession) || params.pricePerSession < 0) {
      return { success: false, error: 'Price must be a non-negative integer.' }
    }
    update.price_per_session = params.pricePerSession
  }
  if (params.active !== undefined) {
    update.active = params.active
  }

  const { error } = await supabase.from('equipment').update(update).eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function deleteEquipment(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  if (!id) return { success: false, error: 'Invalid equipment ID.' }

  const { error } = await supabase.from('equipment').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}
