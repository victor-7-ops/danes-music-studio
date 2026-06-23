'use server'

import { createClient } from '@/lib/supabase/server'

export interface UpsertSpecialHoursParams {
  date: string
  openTime?: string
  closeTime?: string
  isClosed: boolean
}

export async function upsertSpecialHours(
  params: UpsertSpecialHoursParams
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { date, openTime, closeTime, isClosed } = params

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { success: false, error: 'Invalid date.' }
  }
  if (!isClosed && (!openTime || !closeTime)) {
    return { success: false, error: 'openTime and closeTime are required when not closed.' }
  }

  // D-15: upsert on UNIQUE constraint on date
  // NOTE: column name is `closed` (not `is_closed`)
  const { error } = await supabase.from('special_hours').upsert(
    {
      date,
      open_time: openTime ?? null,
      close_time: closeTime ?? null,
      closed: isClosed,
    },
    { onConflict: 'date' }
  )

  if (error) return { success: false, error: error.message }
  return { success: true }
}
