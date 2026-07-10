import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/serviceClient'
import { sendTelegramMessage, paymentProofUploadedMessage } from '@/lib/telegram'
import { isValidImageMagicBytes } from '@/lib/imageMagicBytes'

export const runtime = 'nodejs'

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
}
const MAX_BYTES = 8 * 1024 * 1024

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const ref = (form.get('ref') as string | null)?.trim().toUpperCase() ?? ''
  const file = form.get('file') as File | null

  if (!ref || !file) {
    return NextResponse.json({ error: 'Missing reference or file' }, { status: 400 })
  }
  const ext = ALLOWED_TYPES[file.type]
  if (!ext) {
    return NextResponse.json({ error: 'Upload a JPG, PNG, WEBP, or HEIC image' }, { status: 400 })
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'File is empty' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Image too large (max 8MB)' }, { status: 400 })
  }
  const magicBytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  if (!isValidImageMagicBytes(file.type, magicBytes)) {
    return NextResponse.json({ error: 'File content does not match a valid image' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, confirmation_code, customer_name, band_name')
    .eq('confirmation_code', ref)
    .single()

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }
  if (booking.status !== 'pending') {
    return NextResponse.json({ error: 'This booking is no longer pending payment' }, { status: 409 })
  }

  const path = `${ref}-${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('payment-proofs')
    .upload(path, file, { contentType: file.type, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  // Clear the hold expiry — booking now awaits manual admin review, not the timer.
  await supabase
    .from('bookings')
    .update({ payment_proof_url: path, hold_expires_at: null })
    .eq('id', booking.id)

  void sendTelegramMessage(
    paymentProofUploadedMessage([
      {
        confirmationCode: booking.confirmation_code,
        customerName: booking.customer_name,
        bandName: booking.band_name,
      },
    ])
  ).catch((err: unknown) => {
    console.error('[telegram] proof uploaded alert failed', err)
  })

  return NextResponse.json({ ok: true })
}
