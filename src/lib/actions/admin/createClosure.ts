'use server'

import { createClient } from '@/lib/supabase/server'

export interface CreateClosureParams {
  startAt: string
  endAt: string
  reason?: string
  force?: boolean
}

export interface ClosureConflict {
  id: string
  confirmation_code: string
  band_name: string | null
  customer_name: string
  start_at: string
  end_at: string
}

export type CreateClosureResult =
  | { success: true }
  | { success: false; error: string }
  | { success: false; requiresConfirmation: true; conflicts: ClosureConflict[] }

export async function createClosure(
  params: CreateClosureParams
): Promise<CreateClosureResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') return { success: false, error: 'Unauthorized' }

  const { startAt, endAt, reason, force } = params

  // Validate ISO date strings and ordering
  const startMs = Date.parse(startAt)
  const endMs = Date.parse(endAt)
  if (isNaN(startMs) || isNaN(endMs) || startMs >= endMs) {
    return { success: false, error: 'Invalid date range.' }
  }

  const { data, error } = await supabase.rpc('create_admin_closure', {
    p_start_at: new Date(startMs).toISOString(),
    p_end_at: new Date(endMs).toISOString(),
    p_reason: reason ?? null,
    p_force: Boolean(force),
  })
  if (error) return { success: false, error: error.message }
  const result = data as { success?: boolean; requiresConfirmation?: boolean; conflicts?: ClosureConflict[] }
  if (result.requiresConfirmation) return { success: false, requiresConfirmation: true, conflicts: result.conflicts ?? [] }
  if (result.success) return { success: true }
  return { success: false, error: 'Closure could not be created.' }
}
