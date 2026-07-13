// src/app/admin/settings/page.tsx
// Admin settings — Server Component shell. Fetches settings, rate, equipment,
// and Google Calendar connection state server-side; hands off to a client
// island for form state, submit handlers, and interactive Google Calendar /
// equipment CRUD actions.

import { createClient } from '@/lib/supabase/server'
import SettingsClient from './SettingsClient'

const DEFAULTS = {
  operatingOpen: '09:00',
  operatingClose: '22:00',
  holdWindowMinutes: 15,
  defaultDepositPct: 50,
  reminderEnabled: true,
  ratePerHourDisplay: 350,
  gcashQrUrl: '',
  bankDetails: '',
}

export default async function SettingsPage() {
  const supabase = await createClient()

  const [settingsRes, serviceTypeRes, equipmentRes, gcalRes] = await Promise.all([
    supabase.from('settings').select('*').single(),
    supabase
      .from('service_types')
      .select('rate_per_hour')
      .eq('name', 'Rehearsal')
      .single(),
    supabase
      .from('equipment')
      .select('id, name, price_per_session, active')
      .order('sort_order')
      .order('created_at'),
    supabase.from('google_tokens').select('google_email').single(),
  ])

  let fetchError: string | null = null
  let initialForm = DEFAULTS

  if (settingsRes.error) {
    fetchError = 'Failed to load settings: ' + settingsRes.error.message
  } else if (serviceTypeRes.error) {
    fetchError = 'Failed to load rate: ' + serviceTypeRes.error.message
  } else {
    const s = settingsRes.data
    const st = serviceTypeRes.data
    initialForm = {
      operatingOpen: s.operating_open,
      operatingClose: s.operating_close,
      holdWindowMinutes: s.hold_window_minutes,
      defaultDepositPct: s.default_deposit_pct,
      reminderEnabled: s.reminder_enabled,
      ratePerHourDisplay: Math.round(st.rate_per_hour / 100),
      gcashQrUrl: s.gcash_qr_url ?? '',
      bankDetails: s.bank_details ?? '',
    }
  }

  const initialEquipment = equipmentRes.data ?? []

  const initialGcalConnected = !!gcalRes.data
  const initialGcalEmail = gcalRes.data ? (gcalRes.data.google_email as string) : null

  return (
    <SettingsClient
      initialForm={initialForm}
      fetchError={fetchError}
      initialGcalConnected={initialGcalConnected}
      initialGcalEmail={initialGcalEmail}
      initialEquipment={initialEquipment}
    />
  )
}
