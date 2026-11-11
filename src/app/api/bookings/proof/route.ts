import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/serviceClient'
import { sendTelegramMessage, sendTelegramPhoto, paymentProofUploadedMessage, bookingActionKeyboard } from '@/lib/telegram'
import { isValidImageMagicBytes } from '@/lib/imageMagicBytes'
import { InMemoryRateLimiter } from '@/lib/lookupPreviousBooking'

export const runtime = 'nodejs'

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
}
const MAX_BYTES = 8 * 1024 * 1024
const uploadLimiter = new InMemoryRateLimiter({ limit: 5, windowMs: 60 * 60 * 1000 })

export async function POST(req: NextRequest) {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid upload form' }, { status: 400 })
  }
  const rawRef = form.get('ref')
  const rawToken = form.get('token')
  const rawFile = form.get('file')
  const isFile = typeof rawFile === 'object' && rawFile !== null
    && typeof (rawFile as File).arrayBuffer === 'function'
    && typeof (rawFile as File).slice === 'function'
    && typeof (rawFile as File).size === 'number'
    && typeof (rawFile as File).type === 'string'
  if (typeof rawRef !== 'string' || typeof rawToken !== 'string' || !isFile) {
    return NextResponse.json({ error: 'Missing booking link or file' }, { status: 400 })
  }
  const ref = rawRef.trim().toUpperCase()
  const token = rawToken.trim()
  const file = rawFile

  if (!ref || !token || !file) {
    return NextResponse.json({ error: 'Missing booking link or file' }, { status: 400 })
  }
  const key = `${req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'}:${token}`
  if (!uploadLimiter.check(key)) return NextResponse.json({ error: 'Too many uploads. Try again later.' }, { status: 429 })
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

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select(
      'id, status, hold_expires_at, payment_proof_url, confirmation_code, customer_name, band_name, payment_method, deposit_amount, amount_paid, total_amount, service_types(name)'
    )
    .eq('confirmation_code', ref)
    .eq('cancel_token', token)
    .single()

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }
  if (booking.status !== 'pending') {
    return NextResponse.json({ error: 'This booking is no longer pending payment' }, { status: 409 })
  }
  if ((booking.hold_expires_at && booking.hold_expires_at <= new Date().toISOString()) || booking.payment_proof_url) {
    return NextResponse.json({ error: booking.payment_proof_url ? 'Payment proof has already been submitted' : 'This payment hold has expired' }, { status: 409 })
  }

  const path = `${booking.id}/${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('payment-proofs')
    .upload(path, file, { contentType: file.type, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  // Conditional update is the atomic single-upload claim. On failure remove
  // the object so it cannot become an orphan or overwrite an accepted proof.
  const now = new Date().toISOString()
  const { data: updated, error: updateError } = await supabase
    .from('bookings')
    .update({ payment_proof_url: path, hold_expires_at: null })
    .eq('id', booking.id)
    .eq('status', 'pending')
    .is('payment_proof_url', null)
    .or(`hold_expires_at.is.null,hold_expires_at.gt.${now}`)
    .select('id')
    .maybeSingle()

  if (updateError || !updated) {
    await supabase.storage.from('payment-proofs').remove([path])
    return NextResponse.json({ error: 'Booking changed before the upload completed. Refresh your private payment link.' }, { status: 409 })
  }

  const svc = booking.service_types as { name: string } | { name: string }[] | null
  const serviceTypeName = (Array.isArray(svc) ? svc[0]?.name : svc?.name) ?? 'Rehearsal'

  const caption = paymentProofUploadedMessage([
    {
      id: booking.id,
      confirmationCode: booking.confirmation_code,
      customerName: booking.customer_name,
      bandName: booking.band_name,
      serviceTypeName,
      paymentMethod: booking.payment_method,
      depositAmount: booking.deposit_amount,
      amountPaid: booking.amount_paid,
      totalAmount: booking.total_amount,
    },
  ])
  const keyboard = bookingActionKeyboard(booking.id)

  void supabase.storage
    .from('payment-proofs')
    .createSignedUrl(path, 600)
    .then(({ data: signed, error: signError }) => {
      console.log('[telegram-debug] signed url result:', !!signed?.signedUrl, signError)
      return signed?.signedUrl
        ? sendTelegramPhoto(signed.signedUrl, caption, keyboard)
        : sendTelegramMessage(caption, keyboard)
    })
    .catch((err: unknown) => {
      console.error('[telegram] proof uploaded alert failed', err)
    })

  return NextResponse.json({ ok: true })
}
