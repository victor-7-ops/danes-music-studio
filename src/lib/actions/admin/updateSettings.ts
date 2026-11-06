'use server'

import { createClient } from '@/lib/supabase/server'

export interface UpdateSettingsParams {
  operatingOpen: string       // "HH:MM"
  operatingClose: string      // "HH:MM"
  holdWindowMinutes: number
  defaultDepositPct: number
  reminderEnabled: boolean
  ratePerHour: number         // integer centavos
  gcashQrUrl: string          // empty string = unset — public URL of the uploaded QR image
  bankName: string            // empty string = unset
  accountName: string         // empty string = unset
  accountNumber: string       // empty string = unset
}

export async function updateSettings(
  params: UpdateSettingsParams
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') return { success: false, error: 'Unauthorized' }

  const { operatingOpen, operatingClose, holdWindowMinutes, defaultDepositPct, reminderEnabled, ratePerHour, gcashQrUrl, bankName, accountName, accountNumber } = params

  const timeOk = /^\d{2}:\d{2}$/.test(operatingOpen) && /^\d{2}:\d{2}$/.test(operatingClose)
  if (!timeOk) return { success: false, error: 'Invalid time format.' }
  if (!/^\d{2}:00$/.test(operatingOpen) || !/^\d{2}:00$/.test(operatingClose) || operatingOpen >= operatingClose || Number(operatingClose.slice(0, 2)) > 24) {
    return { success: false, error: 'Operating hours must use whole hours and close after opening.' }
  }
  if (!Number.isInteger(holdWindowMinutes) || holdWindowMinutes <= 0) {
    return { success: false, error: 'holdWindowMinutes must be a positive integer.' }
  }
  if (!Number.isInteger(defaultDepositPct) || defaultDepositPct < 1 || defaultDepositPct > 100) {
    return { success: false, error: 'defaultDepositPct must be between 1 and 100.' }
  }
  if (!Number.isInteger(ratePerHour) || ratePerHour <= 0) {
    return { success: false, error: 'ratePerHour must be a positive integer.' }
  }

  const { error } = await supabase.rpc('update_studio_settings', {
    p_settings: {
      operating_open: operatingOpen,
      operating_close: operatingClose,
      hold_window_minutes: holdWindowMinutes,
      default_deposit_pct: defaultDepositPct / 100,
      reminder_enabled: reminderEnabled,
      rate_per_hour: ratePerHour,
      gcash_qr_url: gcashQrUrl.trim(),
      bank_name: bankName.trim(),
      account_name: accountName.trim(),
      account_number: accountNumber.trim(),
    },
  })
  if (error) return { success: false, error: error.message }
  return { success: true }
}
