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
  if (!user || user.app_metadata?.role !== 'admin') return { success: false, error: 'Unauthorized' }

  const { date, openTime, closeTime, isClosed } = params

  const dateValue = new Date(`${date}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(dateValue.getTime()) || dateValue.toISOString().slice(0, 10) !== date) {
    return { success: false, error: 'Invalid date.' }
  }
  if (!isClosed && (!openTime || !closeTime)) {
    return { success: false, error: 'openTime and closeTime are required when not closed.' }
  }
  if (!isClosed && (!/^\d{2}:00$/.test(openTime!) || !/^\d{2}:00$/.test(closeTime!) || openTime! >= closeTime! || Number(closeTime!.slice(0, 2)) > 24)) {
    return { success: false, error: 'Special hours must use whole hours and close after opening.' }
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
