'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { updateSettings } from '@/lib/actions/admin/updateSettings'
import { connectGoogleCalendar } from '@/lib/actions/admin/connectGoogleCalendar'
import { disconnectGoogleCalendar } from '@/lib/actions/admin/disconnectGoogleCalendar'

interface FormState {
  operatingOpen: string
  operatingClose: string
  holdWindowMinutes: number
  defaultDepositPct: number
  reminderEnabled: boolean
  ratePerHourDisplay: number // in pesos (centavos / 100)
}

const DEFAULTS: FormState = {
  operatingOpen: '09:00',
  operatingClose: '22:00',
  holdWindowMinutes: 15,
  defaultDepositPct: 50,
  reminderEnabled: true,
  ratePerHourDisplay: 350,
}

export default function SettingsPage() {
  const [form, setForm] = useState<FormState>(DEFAULTS)
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [gcalEmail, setGcalEmail] = useState<string | null>(null)
  const [gcalConnected, setGcalConnected] = useState(false)
  const [gcalLoading, setGcalLoading] = useState(false)
  const [gcalFeedback, setGcalFeedback] = useState<string | null>(null)

  const searchParams = useSearchParams()

  useEffect(() => {
    async function loadSettings() {
      const supabase = createClient()
      const [settingsRes, serviceTypeRes] = await Promise.all([
        supabase.from('settings').select('*').single(),
        supabase
          .from('service_types')
          .select('rate_per_hour')
          .eq('name', 'Rehearsal')
          .single(),
      ])

      if (settingsRes.error) {
        setFetchError('Failed to load settings: ' + settingsRes.error.message)
        return
      }
      if (serviceTypeRes.error) {
        setFetchError('Failed to load rate: ' + serviceTypeRes.error.message)
        return
      }

      const s = settingsRes.data
      const st = serviceTypeRes.data

      setForm({
        operatingOpen: s.operating_open,
        operatingClose: s.operating_close,
        holdWindowMinutes: s.hold_window_minutes,
        defaultDepositPct: s.default_deposit_pct,
        reminderEnabled: s.reminder_enabled,
        ratePerHourDisplay: Math.round(st.rate_per_hour / 100),
      })

      // Fetch Google Calendar connection state
      const { data: gcalRow } = await supabase
        .from('google_tokens')
        .select('google_email')
        .single()
      if (gcalRow) {
        setGcalConnected(true)
        setGcalEmail(gcalRow.google_email as string)
      }
    }

    loadSettings()

    // Read ?gcal= param from OAuth redirect
    const gcalParam = searchParams.get('gcal')
    if (gcalParam === 'connected') setGcalFeedback('Google Calendar connected successfully.')
    else if (gcalParam === 'error_no_refresh_token')
      setGcalFeedback(
        'Connection failed: Google did not return a refresh token. Try disconnecting and reconnecting.'
      )
    else if (gcalParam === 'error') setGcalFeedback('Connection failed. Please try again.')
  }, [searchParams])

  async function handleConnect() {
    setGcalLoading(true)
    await connectGoogleCalendar()
    // redirect() from the action navigates away — no need to reset loading
  }

  async function handleDisconnect() {
    setGcalLoading(true)
    const result = await disconnectGoogleCalendar()
    if (result.success) {
      setGcalConnected(false)
      setGcalEmail(null)
      setGcalFeedback('Google Calendar disconnected.')
    } else {
      setGcalFeedback(result.error ?? 'Disconnect failed.')
    }
    setGcalLoading(false)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setSubmitError(null)
    setSuccess(false)

    const result = await updateSettings({
      operatingOpen: form.operatingOpen,
      operatingClose: form.operatingClose,
      holdWindowMinutes: form.holdWindowMinutes,
      defaultDepositPct: form.defaultDepositPct,
      reminderEnabled: form.reminderEnabled,
      ratePerHour: Math.round(form.ratePerHourDisplay * 100),
    })

    if (result.success) {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } else {
      setSubmitError(result.error ?? 'Save failed')
    }

    setLoading(false)
  }

  const inputClass =
    'w-full border border-ink/20 bg-bg px-3 py-2 font-sans text-sm focus:outline-none focus:border-ink'
  const labelClass = 'font-sans text-sm uppercase tracking-widest text-muted'

  return (
    <div className="p-6 max-w-lg">
      <h1 className="font-display text-3xl uppercase tracking-wide mb-8">Settings</h1>

      {fetchError && (
        <p className="mb-6 font-sans text-sm text-red-600">{fetchError}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Studio Rate */}
        <div>
          <p className={`${labelClass} mb-3`}>Studio Rate</p>
          <label className="block">
            <span className={labelClass}>Hourly rate (₱)</span>
            <input
              type="number"
              min={1}
              step={1}
              required
              className={inputClass}
              value={form.ratePerHourDisplay}
              onChange={(e) =>
                setForm((f) => ({ ...f, ratePerHourDisplay: Number(e.target.value) }))
              }
            />
          </label>
        </div>

        {/* Operating Hours */}
        <div>
          <p className={`${labelClass} mb-3`}>Operating Hours</p>
          <div className="space-y-4">
            <label className="block">
              <span className={labelClass}>Opening time</span>
              <input
                type="time"
                required
                className={inputClass}
                value={form.operatingOpen}
                onChange={(e) =>
                  setForm((f) => ({ ...f, operatingOpen: e.target.value }))
                }
              />
            </label>
            <label className="block">
              <span className={labelClass}>Closing time</span>
              <input
                type="time"
                required
                className={inputClass}
                value={form.operatingClose}
                onChange={(e) =>
                  setForm((f) => ({ ...f, operatingClose: e.target.value }))
                }
              />
            </label>
          </div>
        </div>

        {/* Booking Rules */}
        <div>
          <p className={`${labelClass} mb-3`}>Booking Rules</p>
          <div className="space-y-4">
            <label className="block">
              <span className={labelClass}>Hold window (minutes)</span>
              <input
                type="number"
                min={1}
                max={60}
                step={1}
                required
                className={inputClass}
                value={form.holdWindowMinutes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, holdWindowMinutes: Number(e.target.value) }))
                }
              />
            </label>
            <label className="block">
              <span className={labelClass}>Default deposit (%)</span>
              <input
                type="number"
                min={1}
                max={100}
                step={1}
                required
                className={inputClass}
                value={form.defaultDepositPct}
                onChange={(e) =>
                  setForm((f) => ({ ...f, defaultDepositPct: Number(e.target.value) }))
                }
              />
            </label>
          </div>
        </div>

        {/* Notifications */}
        <div>
          <p className={`${labelClass} mb-3`}>Notifications</p>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-ink"
              checked={form.reminderEnabled}
              onChange={(e) =>
                setForm((f) => ({ ...f, reminderEnabled: e.target.checked }))
              }
            />
            <span className="font-sans text-sm text-ink">Send booking reminders</span>
          </label>
          <p className="mt-1 ml-7 font-sans text-xs text-muted">
            Reminder emails sent 24 hours before booking start
          </p>
        </div>

        {/* Google Calendar */}
        <div>
          <p className={`${labelClass} mb-3`}>Google Calendar</p>
          {gcalFeedback && (
            <p className="mb-3 font-sans text-sm text-ink border-l-2 border-ink/20 pl-3">{gcalFeedback}</p>
          )}
          {gcalConnected ? (
            <div className="space-y-3">
              <p className="font-sans text-sm text-ink">
                Connected as <span className="font-semibold">{gcalEmail}</span>
              </p>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={gcalLoading}
                className="bg-ink text-bg px-4 py-2 font-sans text-sm hover:opacity-80 transition-opacity uppercase tracking-widest disabled:opacity-50"
              >
                {gcalLoading ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleConnect}
              disabled={gcalLoading}
              className="bg-ink text-bg px-4 py-2 font-sans text-sm hover:opacity-80 transition-opacity uppercase tracking-widest disabled:opacity-50"
            >
              {gcalLoading ? 'Connecting...' : 'Connect Google Calendar'}
            </button>
          )}
        </div>

        {/* D-13 note */}
        <p className="font-sans text-xs text-muted border-l-2 border-ink/20 pl-3">
          Changes apply to new bookings only. Existing bookings are not updated.
        </p>

        {/* Feedback */}
        {submitError && (
          <p className="font-sans text-sm text-red-600">{submitError}</p>
        )}
        {success && (
          <p className="font-sans text-sm text-green-700">Settings saved</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="bg-ink text-bg px-6 py-3 font-sans text-sm hover:opacity-80 transition-opacity uppercase tracking-widest disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  )
}
