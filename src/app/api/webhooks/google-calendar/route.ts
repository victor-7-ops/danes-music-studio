export const runtime = 'nodejs'

import { runPullSync } from '@/lib/gcal/pullSync'

export async function POST(request: Request) {
  const channelToken = request.headers.get('x-goog-channel-token')
  if (channelToken !== process.env.GCAL_WEBHOOK_TOKEN) {
    return new Response('Forbidden', { status: 403 })
  }

  const resourceState = request.headers.get('x-goog-resource-state')

  if (resourceState === 'sync') {
    // Initial handshake — acknowledge and do nothing
    return new Response('OK', { status: 200 })
  }

  if (resourceState === 'not_exists') {
    console.warn('[gcal-webhook] calendar deleted notification')
    return new Response('OK', { status: 200 })
  }

  if (resourceState === 'exists') {
    // Fire-and-forget — do not block the 200 response
    void runPullSync().catch((err: unknown) => {
      console.error('[gcal-webhook] pull sync failed', err)
    })
    return new Response('OK', { status: 200 })
  }

  // Unknown state — acknowledge and ignore
  return new Response('OK', { status: 200 })
}
