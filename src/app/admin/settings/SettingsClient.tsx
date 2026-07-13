'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { updateSettings } from '@/lib/actions/admin/updateSettings'
import { connectGoogleCalendar } from '@/lib/actions/admin/connectGoogleCalendar'
import { disconnectGoogleCalendar } from '@/lib/actions/admin/disconnectGoogleCalendar'
import { syncGoogleCalendar } from '@/lib/actions/admin/syncGoogleCalendar'
import { createEquipment, updateEquipment, deleteEquipment } from '@/lib/actions/admin/equipment'

interface EquipmentRow {
  id: string
  name: string
  price_per_session: number
  quantity: number
  active: boolean
}

interface FormState {
  operatingOpen: string
  operatingClose: string
  holdWindowMinutes: number
  defaultDepositPct: number
  reminderEnabled: boolean
  ratePerHourDisplay: number // in pesos (centavos / 100)
  gcashQrUrl: string
  bankName: string
  accountName: string
  accountNumber: string
}

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
  const [form, setForm] = useState<FormState>(initialForm)
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [qrUploading, setQrUploading] = useState(false)
  const [qrError, setQrError] = useState<string | null>(null)

  const [gcalEmail, setGcalEmail] = useState<string | null>(initialGcalEmail)
  const [gcalConnected, setGcalConnected] = useState(initialGcalConnected)
  const [gcalLoading, setGcalLoading] = useState(false)
  const [gcalFeedback, setGcalFeedback] = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<string | null>(null)

  const [equipment, setEquipment] = useState<EquipmentRow[]>(initialEquipment)
  const [newEquipName, setNewEquipName] = useState('')
  const [newEquipPrice, setNewEquipPrice] = useState<number | ''>('')
  const [newEquipQuantity, setNewEquipQuantity] = useState<number | ''>(1)
  const [equipError, setEquipError] = useState<string | null>(null)
  const [equipLoading, setEquipLoading] = useState(false)

  const searchParams = useSearchParams()

  async function reloadEquipment() {
    const supabase = createClient()
    const { data } = await supabase
      .from('equipment')
      .select('id, name, price_per_session, quantity, active')
      .order('sort_order')
      .order('created_at')
    setEquipment(data ?? [])
  }

  useEffect(() => {
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

  async function handleSync() {
    setGcalLoading(true)
    setSyncResult(null)
    const result = await syncGoogleCalendar()
    if (result.success) {
      setSyncResult(
        `Synced: ${result.inserted ?? 0} added, ${result.deleted ?? 0} removed, ${result.conflicts ?? 0} conflict(s) skipped.`
      )
    } else {
      setSyncResult(result.error ?? 'Sync failed.')
    }
    setGcalLoading(false)
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

  async function handleQrUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setQrError('Upload an image file.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setQrError('Image too large (max 5MB).')
      return
    }

    setQrUploading(true)
    setQrError(null)

    const supabase = createClient()
    const ext = file.name.split('.').pop() || 'png'
    const path = `qr-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('payment-qr')
      .upload(path, file, { contentType: file.type, upsert: false })

    if (uploadError) {
      setQrError('Upload failed: ' + uploadError.message)
      setQrUploading(false)
      return
    }

    const { data: publicUrlData } = supabase.storage.from('payment-qr').getPublicUrl(path)
    const newUrl = publicUrlData.publicUrl

    // Saves immediately — QR image is independent of the rest of the settings form.
    const result = await updateSettings({
      operatingOpen: form.operatingOpen,
      operatingClose: form.operatingClose,
      holdWindowMinutes: form.holdWindowMinutes,
      defaultDepositPct: form.defaultDepositPct,
      reminderEnabled: form.reminderEnabled,
      ratePerHour: Math.round(form.ratePerHourDisplay * 100),
      gcashQrUrl: newUrl,
      bankName: form.bankName,
      accountName: form.accountName,
      accountNumber: form.accountNumber,
    })

    if (result.success) {
      setForm((f) => ({ ...f, gcashQrUrl: newUrl }))
    } else {
      setQrError(result.error ?? 'Failed to save QR image.')
    }
    setQrUploading(false)
  }

  async function handleAddEquipment(e: React.FormEvent) {
    e.preventDefault()
    setEquipError(null)
    if (newEquipName.trim().length < 1 || newEquipPrice === '' || newEquipPrice < 0) {
      setEquipError('Enter a name and a valid price.')
      return
    }
    if (newEquipQuantity === '' || !Number.isInteger(newEquipQuantity) || newEquipQuantity < 1) {
      setEquipError('Quantity must be a positive whole number.')
      return
    }
    setEquipLoading(true)
    const result = await createEquipment({
      name: newEquipName,
      pricePerSession: Math.round(newEquipPrice * 100),
      quantity: newEquipQuantity,
    })
    if (result.success) {
      setNewEquipName('')
      setNewEquipPrice('')
      setNewEquipQuantity(1)
      await reloadEquipment()
    } else {
      setEquipError(result.error ?? 'Failed to add equipment.')
    }
    setEquipLoading(false)
  }

  async function handleToggleEquipment(id: string, active: boolean) {
    setEquipLoading(true)
    const result = await updateEquipment(id, { active: !active })
    if (result.success) {
      await reloadEquipment()
    } else {
      setEquipError(result.error ?? 'Failed to update equipment.')
    }
    setEquipLoading(false)
  }

  async function handleUpdateQuantity(id: string, quantity: number) {
    if (!Number.isInteger(quantity) || quantity < 1) return
    setEquipLoading(true)
    const result = await updateEquipment(id, { quantity })
    if (result.success) {
      await reloadEquipment()
    } else {
      setEquipError(result.error ?? 'Failed to update equipment.')
    }
    setEquipLoading(false)
  }

  async function handleDeleteEquipment(id: string) {
    setEquipLoading(true)
    const result = await deleteEquipment(id)
    if (result.success) {
      await reloadEquipment()
    } else {
      setEquipError(result.error ?? 'Failed to delete equipment.')
    }
    setEquipLoading(false)
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
      gcashQrUrl: form.gcashQrUrl,
      bankName: form.bankName,
      accountName: form.accountName,
      accountNumber: form.accountNumber,
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
              value={form.ratePerHourDisplay || ''}
              onChange={(e) =>
                setForm((f) => ({ ...f, ratePerHourDisplay: e.target.value === '' ? 0 : Number(e.target.value) }))
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

        {/* Manual Payment */}
        <div className="border border-ink/20 p-5">
          <p className={`${labelClass} mb-4`}>Bank Transfer (InstaPay)</p>
          <div className="space-y-4">
            <label className="block">
              <span className={labelClass}>Bank name</span>
              <input
                type="text"
                className={inputClass}
                placeholder="GCASH"
                value={form.bankName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, bankName: e.target.value }))
                }
              />
            </label>
            <label className="block">
              <span className={labelClass}>Account name</span>
              <input
                type="text"
                className={inputClass}
                placeholder="Juan Dela Cruz"
                value={form.accountName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, accountName: e.target.value }))
                }
              />
            </label>
            <label className="block">
              <span className={labelClass}>Account number</span>
              <input
                type="text"
                className={inputClass}
                placeholder="0012 3456 7890"
                value={form.accountNumber}
                onChange={(e) =>
                  setForm((f) => ({ ...f, accountNumber: e.target.value }))
                }
              />
            </label>
            <div>
              <span className={`${labelClass} block mb-2`}>QR code (InstaPay / GCash / any bank)</span>
              <div className="flex items-center gap-4">
                {form.gcashQrUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={form.gcashQrUrl}
                    alt="Payment QR code"
                    className="h-20 w-20 border border-ink/20 object-contain bg-bg"
                  />
                ) : (
                  <div className="h-20 w-20 border border-dashed border-ink/20 flex items-center justify-center">
                    <span className="font-sans text-[10px] text-muted uppercase tracking-widest">No QR</span>
                  </div>
                )}
                <label className="cursor-pointer">
                  <span className="inline-block bg-ink/5 text-ink px-4 py-2 font-sans text-sm hover:bg-ink/10 transition-colors uppercase tracking-widest">
                    {qrUploading ? 'Uploading...' : form.gcashQrUrl ? 'Replace QR' : 'Upload QR'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={qrUploading}
                    onChange={handleQrUpload}
                  />
                </label>
              </div>
              {qrError && (
                <p className="mt-2 font-sans text-sm text-red-600">{qrError}</p>
              )}
            </div>
          </div>
          <p className="mt-4 font-sans text-xs text-muted">
            Shown to customers on their booking ticket so they can pay via InstaPay. QR uploads save
            immediately.
          </p>
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
              <button
                type="button"
                onClick={handleSync}
                disabled={gcalLoading}
                className="bg-ink text-bg px-4 py-2 font-sans text-sm hover:opacity-80 transition-opacity uppercase tracking-widest disabled:opacity-50"
              >
                {gcalLoading ? 'Syncing...' : 'Sync Now'}
              </button>
              {syncResult && (
                <p className="font-sans text-xs text-muted">{syncResult}</p>
              )}
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

      {/* Equipment / Gear — own section, own mutations (not part of the settings form above) */}
      <div className="mt-10 pt-8 border-t border-ink/10">
        <p className={`${labelClass} mb-3`}>Equipment / Gear</p>
        <p className="mb-4 font-sans text-xs text-muted">
          Added as an optional add-on at booking time. Price is flat per session, added to the studio total.
        </p>

        {equipment.length > 0 && (
          <div className="border border-ink/20 divide-y divide-ink/10 mb-4">
            {equipment.map((item) => (
              <div key={item.id} className="flex items-center justify-between px-3 py-2 gap-3">
                <div className={`flex-1 font-sans text-sm ${item.active ? 'text-ink' : 'text-muted line-through'}`}>
                  {item.name}
                </div>
                <div className="font-sans text-sm text-ink tabular-nums">
                  ₱{(item.price_per_session / 100).toLocaleString('en-PH')}
                </div>
                <label className="flex items-center gap-1">
                  <span className="font-sans text-xs text-muted">Qty</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={item.quantity}
                    disabled={equipLoading}
                    onChange={(e) => {
                      const value = Number(e.target.value)
                      if (Number.isInteger(value) && value >= 1) {
                        handleUpdateQuantity(item.id, value)
                      }
                    }}
                    className="w-16 border border-ink/20 bg-bg px-1 py-1 font-sans text-sm text-center focus:outline-none focus:border-ink disabled:opacity-50"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => handleToggleEquipment(item.id, item.active)}
                  disabled={equipLoading}
                  className="font-sans text-xs uppercase tracking-widest text-muted hover:text-ink underline disabled:opacity-50"
                >
                  {item.active ? 'Disable' : 'Enable'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteEquipment(item.id)}
                  disabled={equipLoading}
                  className="font-sans text-xs uppercase tracking-widest text-red-600 hover:opacity-70 underline disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleAddEquipment} className="flex flex-wrap items-end gap-3">
          <label className="block flex-1 min-w-[160px]">
            <span className={labelClass}>Name</span>
            <input
              type="text"
              className={inputClass}
              placeholder="Extra mic"
              value={newEquipName}
              onChange={(e) => setNewEquipName(e.target.value)}
            />
          </label>
          <label className="block w-32">
            <span className={labelClass}>Price (₱)</span>
            <input
              type="number"
              min={0}
              step={1}
              className={inputClass}
              value={newEquipPrice}
              onChange={(e) =>
                setNewEquipPrice(e.target.value === '' ? '' : Number(e.target.value))
              }
            />
          </label>
          <label className="block w-24">
            <span className={labelClass}>Quantity</span>
            <input
              type="number"
              min={1}
              step={1}
              className={inputClass}
              value={newEquipQuantity}
              onChange={(e) =>
                setNewEquipQuantity(e.target.value === '' ? '' : Number(e.target.value))
              }
            />
          </label>
          <button
            type="submit"
            disabled={equipLoading}
            className="bg-ink text-bg px-4 py-2 font-sans text-sm hover:opacity-80 transition-opacity uppercase tracking-widest disabled:opacity-50"
          >
            {equipLoading ? 'Adding...' : 'Add'}
          </button>
        </form>

        {equipError && (
          <p className="mt-2 font-sans text-sm text-red-600">{equipError}</p>
        )}
      </div>
    </div>
  )
}
