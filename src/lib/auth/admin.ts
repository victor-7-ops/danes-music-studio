import { createClient } from '@/lib/supabase/server'

export async function isStudioAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  return !error && user?.app_metadata?.role === 'admin'
}

export async function requireStudioAdmin(): Promise<boolean> {
  return isStudioAdmin()
}
