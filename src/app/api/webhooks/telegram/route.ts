export const runtime = 'nodejs'

import { createServiceClient } from '@/lib/supabase/serviceClient'
import { applyPaymentConfirmation } from '@/lib/bookingOps/confirmPayment'
import { applyBookingCancellation } from '@/lib/bookingOps/cancelBooking'
import { answerTelegramCallback, editTelegramMessage } from '@/lib/telegram'

type TelegramUpdate = {
  callback_query?: {
    id: string
    data?: string
    message?: { chat: { id: number }; message_id: number; text?: string }
  }
}

export async function POST(request: Request) {
  const secret = request.headers.get('x-telegram-bot-api-secret-token')
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response('Forbidden', { status: 403 })
  }

  const update = (await request.json()) as TelegramUpdate
  const callback = update.callback_query
  if (!callback?.data || !callback.message) {
    return new Response('OK', { status: 200 })
  }

  const [action, bookingId] = callback.data.split(':')
  if ((action !== 'confirm' && action !== 'cancel') || !bookingId) {
    return new Response('OK', { status: 200 })
  }

  const supabase = createServiceClient()

  let result
  if (action === 'confirm') {
    const { data: booking } = await supabase
      .from('bookings')
      .select('total_amount, deposit_amount, payment_method')
      .eq('id', bookingId)
      .single()
    const amountDue = booking?.payment_method === 'deposit' ? booking.deposit_amount : booking?.total_amount ?? 0
    result = await applyPaymentConfirmation(supabase, bookingId, amountDue, booking?.payment_method as 'full' | 'deposit' | undefined)
  } else {
    result = await applyBookingCancellation(supabase, bookingId)
  }

  await answerTelegramCallback(callback.id, result.success ? 'Done' : result.error)

  if (result.success) {
    const label = action === 'confirm' ? '✅ Payment confirmed' : '❌ Booking cancelled'
    await editTelegramMessage(
      callback.message.chat.id,
      callback.message.message_id,
      `${callback.message.text ?? ''}\n\n${label} via Telegram.`
    )
  }

  return new Response('OK', { status: 200 })
}
