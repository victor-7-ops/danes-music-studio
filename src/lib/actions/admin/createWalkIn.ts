'use server'

import { createClient } from '@/lib/supabase/server'
import { pushGcalEvent } from '@/lib/gcal/pushSync'
import { SERVICES, isServiceSlug, type ServiceSlug } from '@/lib/services'

export interface CreateWalkInParams {
  date: string      // "YYYY-MM-DD"
  start: string     // "HH:MM" 24h Manila
  end: string       // "HH:MM" 24h Manila
  bandName?: string
  service?: ServiceSlug   // defaults to rehearsal
  equipmentIds?: string[]
  voucherCode?: string
}

export async function createWalkIn(
  params: CreateWalkInParams
): Promise<{ success: boolean; error?: string; code?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') return { success: false, error: 'Unauthorized' }

  const service: ServiceSlug = params.service && isServiceSlug(params.service) ? params.service : 'rehearsal'

  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(params.date)
  const startOk = /^(?:[01]\d|2[0-3]):00$/.test(params.start)
  const endOk = /^(?:[01]\d|2[0-3]|24):00$/.test(params.end)
  const startHour = parseInt(params.start.split(':')[0])
  const endHour = parseInt(params.end.split(':')[0])
  const hoursOk = endHour > startHour
  if (!dateOk || !startOk || !endOk || !hoursOk) {
    return { success: false, error: 'Invalid parameters.' }
  }

  const { data, error } = await supabase.rpc('create_admin_booking', {
    p_request: {
      mode: 'walk_in',
      date: params.date,
      start: params.start,
      end: params.end,
      service: SERVICES[service].name,
      customer_name: params.bandName?.trim() || 'Walk-in',
      customer_email: '',
      customer_phone: '',
      band_name: params.bandName?.trim() || null,
      equipment_ids: [...new Set(params.equipmentIds ?? [])],
      voucher_code: params.voucherCode?.trim() || null,
    },
  })

  if (error || !data) {
    const message = error?.message ?? ''
    if (/bookings_no_overlap/i.test(message)) return { success: false, error: 'Time slot overlaps an existing booking.' }
    if (/equipment_unavailable/i.test(message)) return { success: false, error: 'Requested equipment is unavailable for the selected time.' }
    if (/voucher_/i.test(message)) return { success: false, error: 'That voucher code is not valid for this booking.' }
    if (/invalid_booking_parameters/i.test(message)) return { success: false, error: 'Invalid parameters.' }
    return { success: false, error: message || 'Something went wrong.' }
  }

  const result = data as { id: string; code: string; status: string }
  await pushGcalEvent(result.id).catch((err: unknown) => {
    console.error('[gcal:push] createWalkIn failed', err)
  })

  return { success: true, code: result.code }
}
