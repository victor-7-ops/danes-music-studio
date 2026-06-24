export const runtime = 'nodejs'

import { runPullSync } from '@/lib/gcal/pullSync'

export async function POST(request: Request) {
  const secret = request.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return new Response('Forbidden', { status: 403 })
  }

  try {
    const result = await runPullSync()
    return Response.json({ ok: true, ...result })
  } catch (err) {
    console.error('[gcal-cron:pull] failed', err)
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 }
    )
  }
}
