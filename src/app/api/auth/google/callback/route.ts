export const runtime = 'nodejs'

import { cookies } from 'next/headers'
import { createOAuth2Client, registerWatchChannel } from '@/lib/gcal/client'
import { encryptToken } from '@/lib/gcal/crypto'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return Response.redirect(new URL('/admin/login', request.url))
  }

  const cookieStore = await cookies()
  const expectedState = cookieStore.get('gcal_oauth_state')?.value
  cookieStore.delete('gcal_oauth_state')

  if (!state || !expectedState || state !== expectedState) {
    console.error('[gcal:callback] state mismatch — possible CSRF attempt')
    return Response.redirect(new URL('/admin/settings?gcal=error_state_mismatch', request.url))
  }

  if (!code) {
    return Response.redirect(new URL('/admin/settings?gcal=error', request.url))
  }

  try {
    const oauth2Client = createOAuth2Client()
    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.refresh_token) {
      console.error('[gcal:callback] no refresh_token — prompt:consent may be missing')
      return Response.redirect(new URL('/admin/settings?gcal=error_no_refresh_token', request.url))
    }

    const tokenInfo = await oauth2Client.getTokenInfo(tokens.access_token!)
    const googleEmail = tokenInfo.email!

    const encrypted = encryptToken(tokens.refresh_token)

    // Delete existing rows (single-row table, no sentinel needed)
    await supabase.from('google_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    // Insert fresh row
    await supabase.from('google_tokens').insert({
      encrypted_refresh_token: encrypted,
      google_email: googleEmail,
      calendar_id: 'primary',
      updated_at: new Date().toISOString(),
    })

    // Register watch channel — fire-and-forget, production only
    if (process.env.VERCEL_ENV === 'production') {
      void registerWatchChannel({
        webhookUrl: process.env.GOOGLE_REDIRECT_URI!.replace(
          '/api/auth/google/callback',
          '/api/webhooks/google-calendar'
        ),
        verificationToken: process.env.GCAL_WEBHOOK_TOKEN!,
      })
        .then(async ({ channelId, resourceId, expiration }) => {
          await supabase
            .from('google_tokens')
            .update({
              watch_channel_id: channelId,
              watch_resource_id: resourceId,
              watch_expires_at: new Date(Number(expiration)).toISOString(),
            })
            .neq('id', '00000000-0000-0000-0000-000000000000')
        })
        .catch((err) => console.error('[gcal:callback] watch registration failed', err))
    }

    return Response.redirect(new URL('/admin/settings?gcal=connected', request.url))
  } catch (err) {
    console.error('[gcal:callback] token exchange failed', err)
    return Response.redirect(new URL('/admin/settings?gcal=error', request.url))
  }
}
