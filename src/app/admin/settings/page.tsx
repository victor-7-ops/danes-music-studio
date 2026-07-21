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
  bankName: '',
  accountName: '',
  accountNumber: '',
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
      .select('id, name, price_per_session, quantity, active')
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
      // Postgres `time` columns come back as "HH:MM:SS" — the settings form
      // and its <input type="time"> work in "HH:MM".
      operatingOpen: s.operating_open.slice(0, 5),
      operatingClose: s.operating_close.slice(0, 5),
      holdWindowMinutes: s.hold_window_minutes,
      // DB stores a fraction (numeric(4,3), e.g. 0.500) — form/API work in
      // whole percent integers (1-100).
      defaultDepositPct: Math.round(s.default_deposit_pct * 100),
      reminderEnabled: s.reminder_enabled,
      ratePerHourDisplay: Math.round(st.rate_per_hour / 100),
      gcashQrUrl: s.gcash_qr_url ?? '',
      bankName: s.bank_name ?? '',
      accountName: s.account_name ?? '',
      accountNumber: s.account_number ?? '',
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
