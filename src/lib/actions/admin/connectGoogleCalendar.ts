'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createOAuth2Client, generateAuthUrl } from '@/lib/gcal/client'

export async function connectGoogleCalendar(): Promise<never> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const state = randomUUID()
  const cookieStore = await cookies()
  cookieStore.set('gcal_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes — OAuth consent flow should complete quickly
    path: '/',
  })

  const oauth2Client = createOAuth2Client()
  const url = generateAuthUrl(oauth2Client, state)
  redirect(url)
}
