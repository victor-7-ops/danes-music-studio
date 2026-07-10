import { createHmac, timingSafeEqual } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import type { TablesInsert } from '@/types/database'
import { sendConfirmEmail } from '@/lib/emails/confirm'
import { pushGcalEvent } from '@/lib/gcal/pushSync'
import { sendTelegramMessage, paymentConfirmedMessage } from '@/lib/telegram'

export const runtime = 'nodejs'

type PayMongoEvent = {
  data: {
    id: string
    attributes: {
      type?: string
      reference_number?: string
      data?: {
        attributes?: {
          reference_number?: string
        }
      }
    }
  }
  type: string
}

function verifySignature(rawBody: string, sigHeader: string): boolean {
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET
  if (!secret) return false

  // Handle compound format: 't=...,v1=<hex>' or plain hex
  let sigHex: string
  if (sigHeader.includes('v1=')) {
    const v1Part = sigHeader.split(',').find(p => p.startsWith('v1='))
    if (!v1Part) return false
    sigHex = v1Part.slice(3) // remove 'v1='
  } else {
    sigHex = sigHeader
  }

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')

  const expectedBuf = Buffer.from(expected, 'hex')
  const actualBuf = Buffer.from(sigHex, 'hex')

  if (expectedBuf.length !== actualBuf.length) return false

  return timingSafeEqual(expectedBuf, actualBuf)
}

export async function POST(request: Request) {
  // CRITICAL: Read raw body first — before any other body access
  const rawBody = await request.text()
  const sigHeader = request.headers.get('Paymongo-Signature') ?? ''

  if (!verifySignature(rawBody, sigHeader)) {
    return new Response('Invalid signature', { status: 400 })
  }

  let event: PayMongoEvent
  try {
    event = JSON.parse(rawBody) as PayMongoEvent
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  // Only process these two event types
  if (
    event.type !== 'payment.paid' &&
    event.type !== 'checkout_session.payment.paid'
  ) {
    return new Response('OK', { status: 200 })
  }

  const providerRef = event.data.id

  // Extract reference number — try both locations
  const referenceNumber =
    event.data.attributes.reference_number ??
    event.data.attributes.data?.attributes?.reference_number

  if (!referenceNumber) {
    console.error('webhook: no reference_number found in event', providerRef)
    return new Response('OK', { status: 200 })
  }

  try {
    const supabase = await createClient()

    // Idempotency guard — check if this payment was already processed
    const { data: existing } = await supabase
      .from('payments')
      .select('id')
      .eq('provider_ref', providerRef)
      .single()

    if (existing) {
      return new Response('OK', { status: 200 })
    }

    // Look up booking by confirmation code (= referenceNumber)
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, deposit_amount, total_amount, payment_method, status, customer_email, customer_name, band_name, start_at, end_at, confirmation_code, cancel_token')
      .eq('confirmation_code', referenceNumber)
      .single()

    if (bookingError || !booking) {
      console.error('webhook: booking not found for ref', referenceNumber, bookingError)
      // Return 200 — PayMongo must not retry for unknown bookings
      return new Response('OK', { status: 200 })
    }

    // Amount from booking row — never from webhook payload (T-03-08)
    // All amounts are centavos integers (CLAUDE.md invariant 3)
    const amountPaid =
      booking.payment_method === 'deposit'
        ? booking.deposit_amount
        : booking.total_amount

    // Update booking to confirmed
    await supabase
      .from('bookings')
      .update({ status: 'confirmed', amount_paid: amountPaid })
      .eq('id', booking.id)

    // Fire-and-forget confirm email — never await (D-06: must not block 200 response)
    void sendConfirmEmail({ ...booking, amount_paid: amountPaid }).catch((err: unknown) => {
      console.error('[email] confirm failed', err)
    })

    // Fire-and-forget GCal push — never await (T-07-12: must not block 200 response)
    void pushGcalEvent(booking.id).catch((err: unknown) => {
      console.error('[gcal:push] paymongo webhook failed', err)
    })

    // Fire-and-forget Telegram alert — never await, must not block 200 response
    void sendTelegramMessage(
      paymentConfirmedMessage({
        confirmationCode: booking.confirmation_code,
        customerName: booking.customer_name,
        bandName: booking.band_name,
        amountPaid,
      })
    ).catch((err: unknown) => {
      console.error('[telegram] payment confirmed alert failed', err)
    })

    // Insert payment audit row
    const paymentRow: TablesInsert<'payments'> = {
      booking_id: booking.id,
      provider: 'paymongo',
      provider_ref: providerRef,
      amount: amountPaid,
      kind: booking.payment_method === 'deposit' ? 'deposit' : 'full',
      status: 'paid',
    }
    await supabase.from('payments').insert(paymentRow)

    return new Response('OK', { status: 200 })
  } catch (err) {
    console.error('webhook: unexpected error', err)
    return new Response('Internal error', { status: 500 })
  }
}
