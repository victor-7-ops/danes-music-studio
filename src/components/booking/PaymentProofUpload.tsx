'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface PaymentProofUploadProps {
  confirmationCode: string
}

export function PaymentProofUpload({ confirmationCode }: PaymentProofUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleUpload() {
    if (!file) return
    setLoading(true)
    setError(null)

    const form = new FormData()
    form.set('ref', confirmationCode)
    form.set('file', file)

    try {
      const res = await fetch('/api/bookings/proof', { method: 'POST', body: form })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? 'Upload failed. Please try again.')
        setLoading(false)
        return
      }
      router.push(`/book/confirm?code=${confirmationCode}&proof=uploaded`)
    } catch {
      setError('Upload failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm space-y-3">
      <label className="block">
        <span className="font-sans text-sm uppercase tracking-widest text-muted block mb-2">
          Upload payment screenshot
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={loading}
          className="w-full font-sans text-sm text-ink file:mr-4 file:py-2 file:px-4 file:border-0 file:bg-ink file:text-bg file:uppercase file:tracking-widest file:text-xs file:cursor-pointer"
        />
      </label>

      {error && (
        <p role="alert" className="font-sans text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        onClick={handleUpload}
        disabled={!file || loading}
        className="w-full bg-ink text-bg px-6 py-3 font-sans text-sm uppercase tracking-widest hover:opacity-80 transition-opacity disabled:opacity-50"
      >
        {loading ? 'Uploading…' : 'Submit Proof'}
      </button>
    </div>
  )
}
