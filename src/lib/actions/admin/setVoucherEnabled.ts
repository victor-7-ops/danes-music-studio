'use server'

import { createClient } from '@/lib/supabase/server'

export async function setVoucherEnabled(id: string, enabled: boolean): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('vouchers').update({ enabled }).eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}
