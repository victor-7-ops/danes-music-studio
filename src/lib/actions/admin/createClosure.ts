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
  if (!user) return { success: false, error: 'Unauthorized' }

  const { startAt, endAt, reason, force } = params

  // Validate ISO date strings and ordering
  const startMs = Date.parse(startAt)
  const endMs = Date.parse(endAt)
  if (isNaN(startMs) || isNaN(endMs) || startMs >= endMs) {
    return { success: false, error: 'Invalid date range.' }
  }

  if (!force) {
    // D-14: check for conflicting confirmed/pending bookings
    const { data: conflicts, error: overlapError } = await supabase
      .from('bookings')
      .select('id, confirmation_code, band_name, customer_name, start_at, end_at')
      .in('status', ['confirmed', 'pending'])
      .lt('start_at', endAt)
      .gt('end_at', startAt)

    if (overlapError) return { success: false, error: overlapError.message }

    if (conflicts && conflicts.length > 0) {
      return { success: false, requiresConfirmation: true, conflicts }
    }
  }

  const { error: insertError } = await supabase.from('blocked_slots').insert({
    start_at: startAt,
    end_at: endAt,
    reason: reason ?? null,
    type: 'maintenance',
  })

  if (insertError) return { success: false, error: insertError.message }
  return { success: true }
}
