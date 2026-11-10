'use server'

import { createClient } from '@/lib/supabase/server'
import { pushGcalEvent } from '@/lib/gcal/pushSync'

export type PaymentType = 'unpaid' | 'deposit' | 'full'

export interface CreateOnsiteParams {
  date: string           // "YYYY-MM-DD"
  start: string          // "HH:MM" 24h Manila
  end: string            // "HH:MM" 24h Manila
  customerName: string
  customerEmail?: string
  customerPhone: string
  bandName?: string
  paymentType: PaymentType
  equipmentIds?: string[]
  voucherCode?: string
}

export async function createOnsite(
  params: CreateOnsiteParams
): Promise<{ success: boolean; error?: string; code?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') return { success: false, error: 'Unauthorized' }

  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(params.date)
  const startOk = /^(?:[01]\d|2[0-3]):00$/.test(params.start)
  const endOk = /^(?:[01]\d|2[0-3]|24):00$/.test(params.end)
  const startHour = parseInt(params.start.split(':')[0])
  const endHour = parseInt(params.end.split(':')[0])
  const hoursOk = endHour > startHour
  const nameOk = params.customerName.trim().length >= 2
  const phoneOk = params.customerPhone.trim().length >= 7
  if (!dateOk || !startOk || !endOk || !hoursOk || !nameOk || !phoneOk) {
    return { success: false, error: 'Invalid parameters.' }
  }

  const { data, error } = await supabase.rpc('create_admin_booking', {
    p_request: {
      mode: 'onsite',
      date: params.date,
      start: params.start,
      end: params.end,
      service: 'Rehearsal',
      customer_name: params.customerName.trim(),
      customer_email: params.customerEmail?.trim() ?? '',
      customer_phone: params.customerPhone.trim(),
      band_name: params.bandName?.trim() || null,
      payment_type: params.paymentType,
      equipment_ids: [...new Set(params.equipmentIds ?? [])],
      voucher_code: params.voucherCode?.trim() || null,
    },
  })

  if (error || !data) {
    const message = error?.message ?? ''
    if (/bookings_no_overlap/i.test(message)) return { success: false, error: 'That time slot is already booked.' }
    if (/equipment_unavailable/i.test(message)) return { success: false, error: 'Requested equipment is unavailable for the selected time.' }
    if (/voucher_/i.test(message)) return { success: false, error: 'That voucher code is not valid for this booking.' }
    if (/invalid_booking_parameters/i.test(message)) return { success: false, error: 'Invalid parameters.' }
    return { success: false, error: message || 'Something went wrong.' }
  }

  const result = data as { id: string; code: string; status: string }
  if (result.status === 'confirmed') {
    await pushGcalEvent(result.id).catch((err: unknown) => {
      console.error('[gcal:push] createOnsite failed', err)
    })
  }

  return { success: true, code: result.code }
}
