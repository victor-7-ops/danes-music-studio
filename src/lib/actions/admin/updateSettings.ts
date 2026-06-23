'use server'

import { createClient } from '@/lib/supabase/server'

export interface UpdateSettingsParams {
  operatingOpen: string       // "HH:MM"
  operatingClose: string      // "HH:MM"
  holdWindowMinutes: number
  defaultDepositPct: number
  reminderEnabled: boolean
  ratePerHour: number         // integer centavos
}

export async function updateSettings(
  params: UpdateSettingsParams
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { operatingOpen, operatingClose, holdWindowMinutes, defaultDepositPct, reminderEnabled, ratePerHour } = params

  const timeOk = /^\d{2}:\d{2}$/.test(operatingOpen) && /^\d{2}:\d{2}$/.test(operatingClose)
  if (!timeOk) return { success: false, error: 'Invalid time format.' }
  if (!Number.isInteger(holdWindowMinutes) || holdWindowMinutes <= 0) {
    return { success: false, error: 'holdWindowMinutes must be a positive integer.' }
  }
  if (!Number.isInteger(defaultDepositPct) || defaultDepositPct < 1 || defaultDepositPct > 100) {
    return { success: false, error: 'defaultDepositPct must be between 1 and 100.' }
  }
  if (!Number.isInteger(ratePerHour) || ratePerHour <= 0) {
    return { success: false, error: 'ratePerHour must be a positive integer.' }
  }

  // Fetch settings row id
  const { data: settings, error: fetchError } = await supabase
    .from('settings')
    .select('id')
    .single()

  if (fetchError || !settings) {
    return { success: false, error: 'Settings not found.' }
  }

  // Update settings row
  const { error: settingsError } = await supabase
    .from('settings')
    .update({
      operating_open: operatingOpen,
      operating_close: operatingClose,
      hold_window_minutes: holdWindowMinutes,
      default_deposit_pct: defaultDepositPct,
      reminder_enabled: reminderEnabled,
    })
    .eq('id', settings.id)

  if (settingsError) return { success: false, error: settingsError.message }

  // Update service_types rate
  // D-13: no retroactive update to existing bookings
  const { error: rateError } = await supabase
    .from('service_types')
    .update({ rate_per_hour: ratePerHour })
    .eq('name', 'Rehearsal')

  if (rateError) return { success: false, error: rateError.message }

  return { success: true }
}
