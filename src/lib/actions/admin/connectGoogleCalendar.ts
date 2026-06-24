'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createOAuth2Client, generateAuthUrl } from '@/lib/gcal/client'

export async function connectGoogleCalendar(): Promise<never> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const oauth2Client = createOAuth2Client()
  const url = generateAuthUrl(oauth2Client)
  redirect(url)
}
