'use client'

import StudioSettingsForm, { type FormState } from '@/components/admin/StudioSettingsForm'
import GoogleCalendarPanel from '@/components/admin/GoogleCalendarPanel'
import EquipmentPanel, { type EquipmentRow } from '@/components/admin/EquipmentPanel'

interface SettingsClientProps {
  initialForm: FormState
  fetchError: string | null
  initialGcalConnected: boolean
  initialGcalEmail: string | null
  initialEquipment: EquipmentRow[]
}

export default function SettingsClient({
  initialForm,
  fetchError,
  initialGcalConnected,
  initialGcalEmail,
  initialEquipment,
}: SettingsClientProps) {
  return (
    <div className="p-6 max-w-lg">
      <h1 className="font-display text-3xl uppercase tracking-wide mb-8">Settings</h1>

      {fetchError && (
        <p className="mb-6 font-sans text-sm text-red-600">{fetchError}</p>
      )}

      <StudioSettingsForm initialForm={initialForm}>
        <GoogleCalendarPanel
          initialGcalConnected={initialGcalConnected}
          initialGcalEmail={initialGcalEmail}
        />
      </StudioSettingsForm>

      {/* Equipment / Gear — own section, own mutations (not part of the settings form above) */}
      <EquipmentPanel initialEquipment={initialEquipment} />
    </div>
  )
}
