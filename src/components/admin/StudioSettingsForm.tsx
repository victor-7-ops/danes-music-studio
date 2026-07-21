'use client'

import { useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updateSettings } from '@/lib/actions/admin/updateSettings'

export interface FormState {
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

interface StudioSettingsFormProps {
  initialForm: FormState
  /** Rendered inside the form, in the same slot the Google Calendar section
   * occupied before this file was split — keeps DOM order identical. */
  children?: ReactNode
}

const inputClass =
  'w-full rounded-full border border-ink/20 bg-bg px-4 py-2 font-sans text-sm focus:outline-none focus:border-ink'
const labelClass = 'font-sans text-sm uppercase tracking-widest text-muted'

export default function StudioSettingsForm({ initialForm, children }: StudioSettingsFormProps) {
  const [form, setForm] = useState<FormState>(initialForm)
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [qrUploading, setQrUploading] = useState(false)
  const [qrError, setQrError] = useState<string | null>(null)

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
    // Derive the stored extension from the validated MIME type rather than
    // trusting file.name's extension, which is attacker-controlled and can
    // disagree with the actual content. The bucket's allowed_mime_types
    // policy (see supabase/migrations/20260023000000_*.sql) is the real
    // server-side enforcement; this just keeps the client-side path honest.
    const mimeExt: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
      'image/gif': 'gif',
    }
    const ext = mimeExt[file.type] ?? 'png'
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

  return (
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
                  className="h-20 w-20 rounded-2xl border border-ink/20 object-contain bg-bg"
                />
              ) : (
                <div className="h-20 w-20 rounded-2xl border border-dashed border-ink/20 flex items-center justify-center">
                  <span className="font-sans text-[10px] text-muted uppercase tracking-widest">No QR</span>
                </div>
              )}
              <label className="cursor-pointer">
                <span className="inline-block rounded-full bg-ink/5 text-ink px-4 py-2 font-sans text-sm hover:bg-ink/10 transition-colors uppercase tracking-widest">
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

      {children}

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
  )
}
