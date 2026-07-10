const API_BASE = 'https://api.telegram.org'

export async function sendTelegramMessage(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return

  try {
    const res = await fetch(`${API_BASE}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    })
    if (!res.ok) {
      console.error('Telegram notify failed:', res.status, await res.text())
    }
  } catch (e) {
    console.error('Telegram notify failed:', e)
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function formatPesos(centavos: number): string {
  return `₱${(centavos / 100).toLocaleString('en-PH')}`
}

export function newPendingBookingMessage(booking: {
  confirmationCode: string
  customerName: string
  bandName: string | null
  startAt: string
  endAt: string
  totalAmount: number
  depositAmount: number
  paymentMethod: string
}): string {
  const who = booking.bandName
    ? `${escapeHtml(booking.bandName)} (${escapeHtml(booking.customerName)})`
    : escapeHtml(booking.customerName)
  const amountDue =
    booking.paymentMethod === 'deposit' ? booking.depositAmount : booking.totalAmount
  return (
    `🆕 New pending booking <b>${escapeHtml(booking.confirmationCode)}</b>\n` +
    `${who}\n` +
    `${new Date(booking.startAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} – ` +
    `${new Date(booking.endAt).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila' })}\n` +
    `Due now: ${formatPesos(amountDue)} (${booking.paymentMethod})`
  )
}

export function paymentConfirmedMessage(booking: {
  confirmationCode: string
  customerName: string
  bandName: string | null
  amountPaid: number
}): string {
  const who = booking.bandName
    ? `${escapeHtml(booking.bandName)} (${escapeHtml(booking.customerName)})`
    : escapeHtml(booking.customerName)
  return (
    `✅ Payment confirmed — <b>${escapeHtml(booking.confirmationCode)}</b>\n` +
    `${who}\n` +
    `Amount: ${formatPesos(booking.amountPaid)}`
  )
}

export function paymentProofUploadedMessage(bookings: {
  confirmationCode: string
  customerName: string
  bandName: string | null
}[]): string {
  const lines = bookings.map(b => {
    const who = b.bandName
      ? `${escapeHtml(b.bandName)} (${escapeHtml(b.customerName)})`
      : escapeHtml(b.customerName)
    return `<b>${escapeHtml(b.confirmationCode)}</b> — ${who}`
  })
  return `💳 Payment proof uploaded — check and confirm:\n${lines.join('\n')}`
}
